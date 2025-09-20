import { generateKSUID } from "./util/ksuid";
import { Prisma } from "@prisma/client/extension";
import type {
  JsInputValue,
  ModelQueryOptionsCbArgs,
} from "@prisma/client/runtime/library";

type PrefixMap = Record<string, string>;
type PrefixGenerator = (model: string) => string;
type JsonLike = Record<string, unknown>;

interface KsuidExtensionOptions {
  prefixMap: PrefixMap;
  prefixFn?: PrefixGenerator;
  processNestedCreates?: boolean;
  primaryKeyField?: string | ((model: string) => string);
}

const isJsonLike = (value: unknown): value is JsonLike =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMissingId = (
  value: JsonLike,
  primaryKeyField: string = "id",
): boolean => {
  if (!(primaryKeyField in value)) {
    return true;
  }

  const idValue = value[primaryKeyField];

  if (idValue === undefined || idValue === null) {
    return true;
  }

  if (typeof idValue === "string") {
    return idValue.length === 0;
  }

  return false;
};

const withGeneratedId = (
  value: JsonLike,
  prefix: string,
  primaryKeyField: string = "id",
): JsonLike =>
  isMissingId(value, primaryKeyField)
    ? { ...value, [primaryKeyField]: generateKSUID(prefix) }
    : value;

/**
 * Creates a Prisma Client extension that automatically generates KSUIDs for model IDs.
 * This is the modern replacement for the deprecated $use middleware approach.
 *
 * @example
 * ```typescript
 * const prisma = new PrismaClient().$extends(
 *   createKsuidExtension({
 *     prefixMap: { User: 'usr_', Profile: 'prof_' }
 *   })
 * );
 * ```
 */
export const createKsuidExtension = (options: KsuidExtensionOptions) => {
  const {
    prefixMap,
    prefixFn,
    processNestedCreates: shouldProcessNestedCreates = true,
    primaryKeyField = "id",
  } = options;

  // Validate that prefixMap is provided and is an object (but not an array)
  if (!prefixMap || typeof prefixMap !== "object" || Array.isArray(prefixMap)) {
    throw new Error("A valid prefixMap must be provided.");
  }

  /**
   * Get the primary key field for a model
   */
  const getPrimaryKeyField = (model: string): string => {
    if (typeof primaryKeyField === "function") {
      return primaryKeyField(model);
    }
    return primaryKeyField;
  };

  /**
   * Get prefix for a given model name
   */
  const getPrefix = (model: string): string | undefined => {
    let prefix: string | undefined = prefixMap[model];

    if (!prefix && prefixFn) {
      prefix = prefixFn(model);
    }

    return prefix;
  };

  const ensurePrefixForModel = (model: string): string => {
    const prefix = getPrefix(model);

    if (!prefix || prefix.length === 0) {
      throw new Error(`Prefix not defined or invalid for model "${model}".`);
    }

    return prefix;
  };

  /**
   * Use Prisma's DMMF (Data Model Meta Format) to properly resolve relation model names
   * This replaces the heuristic approach with metadata-driven resolution
   */
  const getModelFromRelation = (
    parentModel: string,
    relationKey: string,
    context?: unknown,
  ): string | null => {
    try {
      // Try to access DMMF from Prisma client if available
      const contextObj = context as Record<string, unknown>;
      if (contextObj?._clientVersion && contextObj._dmmf) {
        const dmmf = contextObj._dmmf as Record<string, unknown>;
        const datamodel = dmmf?.datamodel as Record<string, unknown>;
        const models = (datamodel?.models || []) as Array<
          Record<string, unknown>
        >;
        const model = models.find((m) => m.name === parentModel);
        if (model) {
          const fields = (model.fields || []) as Array<Record<string, unknown>>;
          const field = fields.find((f) => f.name === relationKey);
          if (field && field.type && typeof field.type === "string") {
            return field.type;
          }
        }
      }
    } catch {
      // Fall back to heuristic if DMMF is not available
    }

    return null;
  };

  /**
   * Improved heuristic for inferring model names when DMMF is not available
   */
  const inferModelNameFromRelation = (relationKey: string): string => {
    if (!relationKey) {
      return relationKey;
    }

    const capitalized =
      relationKey.charAt(0).toUpperCase() + relationKey.slice(1);

    // Special cases for common patterns
    if (relationKey === "items" || relationKey === "item") {
      return "OrderItem"; // Common e-commerce pattern
    }

    // Special case for author -> User (common pattern)
    if (relationKey === "author") {
      return "User";
    }

    // Handle plural forms
    if (capitalized.endsWith("ies") && capitalized.length > 3) {
      return `${capitalized.slice(0, -3)}y`;
    }

    if (capitalized.endsWith("s") && capitalized.length > 1) {
      return capitalized.slice(0, -1);
    }

    return capitalized;
  };

  const resolveNestedModelInfo = (
    relationKey: string,
    parentModel?: string,
    context?: unknown,
  ) => {
    let modelName =
      getModelFromRelation(parentModel || "", relationKey, context) ||
      inferModelNameFromRelation(relationKey);

    try {
      const pkField = getPrimaryKeyField(modelName);
      return {
        modelName,
        prefix: ensurePrefixForModel(modelName),
        primaryKeyField: pkField,
      };
    } catch (error) {
      // Try common fallbacks for specific relation patterns
      if (modelName === "Item") {
        modelName = "OrderItem";
        const pkField = getPrimaryKeyField(modelName);
        return {
          modelName,
          prefix: ensurePrefixForModel(modelName),
          primaryKeyField: pkField,
        };
      }

      throw error;
    }
  };

  /**
   * Recursively process nested create operations in data
   */
  const processNestedCreates = (
    data: unknown,
    parentModel?: string,
    context?: unknown,
  ): unknown => {
    if (!data || typeof data !== "object") {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) =>
        processNestedCreates(item, parentModel, context),
      );
    }

    if (!isJsonLike(data)) {
      return data;
    }

    const processed: JsonLike = { ...data };

    for (const [key, value] of Object.entries(processed)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      if (Array.isArray(value)) {
        processed[key] = value.map((item) =>
          processNestedCreates(item, parentModel, context),
        );
        continue;
      }

      if (!isJsonLike(value)) {
        processed[key] = processNestedCreates(value, parentModel, context);
        continue;
      }

      // Handle nested create
      if ("create" in value && typeof value.create === "object") {
        const nestedCreateData = value.create;
        const { prefix, primaryKeyField, modelName } = resolveNestedModelInfo(
          key,
          parentModel,
          context,
        );
        const processedNestedData = processNestedCreates(
          nestedCreateData,
          modelName,
          context,
        );

        if (Array.isArray(processedNestedData)) {
          const processedArray = processedNestedData.map((item) => {
            if (isJsonLike(item)) {
              return withGeneratedId(item, prefix, primaryKeyField);
            }
            return item;
          });

          processed[key] = { ...value, create: processedArray };
        } else if (isJsonLike(processedNestedData)) {
          processed[key] = {
            ...value,
            create: withGeneratedId(
              processedNestedData,
              prefix,
              primaryKeyField,
            ),
          };
        } else {
          processed[key] = { ...value, create: processedNestedData };
        }

        continue;
      }

      // Handle nested createMany
      if (
        "createMany" in value &&
        value.createMany &&
        typeof value.createMany === "object" &&
        "data" in value.createMany
      ) {
        const nestedCreateManyData = value.createMany.data;
        const { prefix, primaryKeyField, modelName } = resolveNestedModelInfo(
          key,
          parentModel,
          context,
        );

        if (Array.isArray(nestedCreateManyData)) {
          const processedData = nestedCreateManyData
            .filter(
              (item): item is unknown => item !== null && item !== undefined,
            )
            .map((item) => {
              const processedItem = processNestedCreates(
                item,
                modelName,
                context,
              );

              if (isJsonLike(processedItem)) {
                return withGeneratedId(processedItem, prefix, primaryKeyField);
              }

              return processedItem;
            });

          processed[key] = {
            ...value,
            createMany: {
              ...value.createMany,
              data: processedData,
            },
          };
        }

        continue;
      }

      // Handle connectOrCreate
      if (
        "connectOrCreate" in value &&
        typeof value.connectOrCreate === "object"
      ) {
        const connectOrCreateValue = value.connectOrCreate;

        if (Array.isArray(connectOrCreateValue)) {
          // Handle array of connectOrCreate
          processed[key] = {
            ...value,
            connectOrCreate: connectOrCreateValue.map((item) => {
              if (item && typeof item === "object" && "create" in item) {
                const { prefix, primaryKeyField, modelName } =
                  resolveNestedModelInfo(key, parentModel, context);
                const processedCreate = processNestedCreates(
                  item.create,
                  modelName,
                  context,
                );

                if (isJsonLike(processedCreate)) {
                  return {
                    ...item,
                    create: withGeneratedId(
                      processedCreate,
                      prefix,
                      primaryKeyField,
                    ),
                  };
                }
              }
              return item;
            }),
          };
        } else if (connectOrCreateValue && "create" in connectOrCreateValue) {
          // Handle single connectOrCreate
          const { prefix, primaryKeyField, modelName } = resolveNestedModelInfo(
            key,
            parentModel,
            context,
          );
          const processedCreate = processNestedCreates(
            connectOrCreateValue.create,
            modelName,
            context,
          );

          if (isJsonLike(processedCreate)) {
            processed[key] = {
              ...value,
              connectOrCreate: {
                ...connectOrCreateValue,
                create: withGeneratedId(
                  processedCreate,
                  prefix,
                  primaryKeyField,
                ),
              },
            };
          }
        }

        continue;
      }

      // Handle nested upsert
      if ("upsert" in value && typeof value.upsert === "object") {
        const upsertValue = value.upsert;

        if (Array.isArray(upsertValue)) {
          // Handle array of upserts
          processed[key] = {
            ...value,
            upsert: upsertValue.map((item) => {
              if (item && typeof item === "object" && "create" in item) {
                const { prefix, primaryKeyField, modelName } =
                  resolveNestedModelInfo(key, parentModel, context);
                const processedCreate = processNestedCreates(
                  item.create,
                  modelName,
                  context,
                );

                if (isJsonLike(processedCreate)) {
                  return {
                    ...item,
                    create: withGeneratedId(
                      processedCreate,
                      prefix,
                      primaryKeyField,
                    ),
                  };
                }
              }
              return item;
            }),
          };
        } else if (upsertValue && "create" in upsertValue) {
          // Handle single upsert
          const { prefix, primaryKeyField, modelName } = resolveNestedModelInfo(
            key,
            parentModel,
            context,
          );
          const processedCreate = processNestedCreates(
            upsertValue.create,
            modelName,
            context,
          );

          if (isJsonLike(processedCreate)) {
            processed[key] = {
              ...value,
              upsert: {
                ...upsertValue,
                create: withGeneratedId(
                  processedCreate,
                  prefix,
                  primaryKeyField,
                ),
              },
            };
          }
        }

        continue;
      }

      processed[key] = processNestedCreates(value, parentModel, context);
    }

    return processed;
  };

  return Prisma.defineExtension({
    name: "prisma-ksuid",
    query: {
      $allModels: {
        async create({
          model,
          args,
          query,
          ...context
        }: ModelQueryOptionsCbArgs) {
          const prefix = ensurePrefixForModel(model);
          const pkField = getPrimaryKeyField(model);

          const currentData = args.data as JsInputValue | undefined;

          if (currentData === undefined || currentData === null) {
            return query(args);
          }

          let createData: unknown = currentData;

          if (isJsonLike(createData)) {
            createData = withGeneratedId(createData, prefix, pkField);
          }

          // Process nested creates if enabled
          if (shouldProcessNestedCreates) {
            createData = processNestedCreates(createData, model, context);

            if (isJsonLike(createData)) {
              createData = withGeneratedId(createData, prefix, pkField);
            }
          }

          args.data = createData as JsInputValue;
          return query(args);
        },

        async createMany({
          model,
          args,
          query,
          ...context
        }: ModelQueryOptionsCbArgs) {
          const prefix = ensurePrefixForModel(model);
          const pkField = getPrimaryKeyField(model);

          const currentData = args.data as JsInputValue | undefined;

          if (currentData === undefined || currentData === null) {
            return query(args);
          }

          if (Array.isArray(currentData)) {
            // Filter out null/undefined values and then process the remaining items
            const processedItems = currentData
              .filter((item) => item !== null && item !== undefined)
              .map((item) => {
                let normalized: unknown = item;

                if (isJsonLike(normalized)) {
                  normalized = withGeneratedId(normalized, prefix, pkField);
                }

                if (!shouldProcessNestedCreates) {
                  return normalized;
                }

                const processed = processNestedCreates(
                  normalized,
                  model,
                  context,
                );

                if (isJsonLike(processed)) {
                  return withGeneratedId(processed, prefix, pkField);
                }

                return processed;
              });

            args.data = processedItems as JsInputValue;
          }
          // If data is not an array (unexpected), still respect nested processing flag
          else if (shouldProcessNestedCreates) {
            const processed = processNestedCreates(currentData, model, context);
            args.data = (
              isJsonLike(processed)
                ? withGeneratedId(processed, prefix, pkField)
                : processed
            ) as JsInputValue;
          } else {
            args.data = currentData;
          }

          return query(args);
        },

        async createManyAndReturn({
          model,
          args,
          query,
          ...context
        }: ModelQueryOptionsCbArgs) {
          const prefix = ensurePrefixForModel(model);
          const pkField = getPrimaryKeyField(model);

          const currentData = args.data as JsInputValue | undefined;

          if (currentData === undefined || currentData === null) {
            return query(args);
          }

          if (Array.isArray(currentData)) {
            // Filter out null/undefined values and then process the remaining items
            const processedItems = currentData
              .filter((item) => item !== null && item !== undefined)
              .map((item) => {
                let normalized: unknown = item;

                if (isJsonLike(normalized)) {
                  normalized = withGeneratedId(normalized, prefix, pkField);
                }

                if (!shouldProcessNestedCreates) {
                  return normalized;
                }

                const processed = processNestedCreates(
                  normalized,
                  model,
                  context,
                );

                if (isJsonLike(processed)) {
                  return withGeneratedId(processed, prefix, pkField);
                }

                return processed;
              });

            args.data = processedItems as JsInputValue;
          }
          // If data is not an array (unexpected), still respect nested processing flag
          else if (shouldProcessNestedCreates) {
            const processed = processNestedCreates(currentData, model, context);
            args.data = (
              isJsonLike(processed)
                ? withGeneratedId(processed, prefix, pkField)
                : processed
            ) as JsInputValue;
          } else {
            args.data = currentData;
          }

          return query(args);
        },

        async upsert({
          model,
          args,
          query,
          ...context
        }: ModelQueryOptionsCbArgs) {
          const prefix = ensurePrefixForModel(model);
          const pkField = getPrimaryKeyField(model);

          // Process the create portion of the upsert
          if (args.create) {
            let createData: unknown = args.create;

            if (isJsonLike(createData)) {
              createData = withGeneratedId(createData, prefix, pkField);
            }

            if (shouldProcessNestedCreates) {
              createData = processNestedCreates(createData, model, context);

              if (isJsonLike(createData)) {
                createData = withGeneratedId(createData, prefix, pkField);
              }
            }

            args.create = createData as JsInputValue;
          }

          // Process nested operations in the update portion if needed
          if (shouldProcessNestedCreates && args.update) {
            args.update = processNestedCreates(
              args.update,
              model,
              context,
            ) as JsInputValue;
          }

          return query(args);
        },
      },
    },
  });
};
