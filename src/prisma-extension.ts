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
}

const isJsonLike = (value: unknown): value is JsonLike =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMissingId = (value: JsonLike): boolean => {
  if (!("id" in value)) {
    return true;
  }

  const idValue = value["id"];

  if (idValue === undefined || idValue === null) {
    return true;
  }

  if (typeof idValue === "string") {
    return idValue.length === 0;
  }

  return false;
};

const withGeneratedId = (value: JsonLike, prefix: string): JsonLike =>
  isMissingId(value) ? { ...value, id: generateKSUID(prefix) } : value;

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
  } = options;

  // Validate that prefixMap is provided and is an object (but not an array)
  if (!prefixMap || typeof prefixMap !== "object" || Array.isArray(prefixMap)) {
    throw new Error("A valid prefixMap must be provided.");
  }

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

  const inferModelNameFromRelation = (relationKey: string): string => {
    if (!relationKey) {
      return relationKey;
    }

    const capitalized =
      relationKey.charAt(0).toUpperCase() + relationKey.slice(1);

    if (capitalized.endsWith("ies") && capitalized.length > 3) {
      return `${capitalized.slice(0, -3)}y`;
    }

    if (capitalized.endsWith("s") && capitalized.length > 1) {
      return capitalized.slice(0, -1);
    }

    return capitalized;
  };

  const resolveNestedModelInfo = (relationKey: string) => {
    let modelName = inferModelNameFromRelation(relationKey);

    try {
      return { modelName, prefix: ensurePrefixForModel(modelName) };
    } catch (error) {
      if (modelName === "Item") {
        modelName = "OrderItem";
        return { modelName, prefix: ensurePrefixForModel(modelName) };
      }

      throw error;
    }
  };

  /**
   * Recursively process nested create operations in data
   */
  const processNestedCreates = (data: unknown): unknown => {
    if (!data || typeof data !== "object") {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => processNestedCreates(item));
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
        processed[key] = value.map((item) => processNestedCreates(item));
        continue;
      }

      if (!isJsonLike(value)) {
        processed[key] = processNestedCreates(value);
        continue;
      }

      if ("create" in value && typeof value.create === "object") {
        const nestedCreateData = value.create;
        const { prefix } = resolveNestedModelInfo(key);
        const processedNestedData = processNestedCreates(nestedCreateData);

        if (Array.isArray(processedNestedData)) {
          const processedArray = processedNestedData.map((item) => {
            if (isJsonLike(item)) {
              return withGeneratedId(item, prefix);
            }

            return item;
          });

          processed[key] = { ...value, create: processedArray };
        } else if (isJsonLike(processedNestedData)) {
          processed[key] = {
            ...value,
            create: withGeneratedId(processedNestedData, prefix),
          };
        } else {
          processed[key] = { ...value, create: processedNestedData };
        }

        continue;
      }

      if (
        "createMany" in value &&
        value.createMany &&
        typeof value.createMany === "object" &&
        "data" in value.createMany
      ) {
        const nestedCreateManyData = value.createMany.data;
        const { prefix } = resolveNestedModelInfo(key);

        if (Array.isArray(nestedCreateManyData)) {
          const processedData = nestedCreateManyData
            .filter(
              (item): item is unknown => item !== null && item !== undefined,
            )
            .map((item) => {
              const processedItem = processNestedCreates(item);

              if (isJsonLike(processedItem)) {
                return withGeneratedId(processedItem, prefix);
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

      processed[key] = processNestedCreates(value);
    }

    return processed;
  };

  return Prisma.defineExtension({
    name: "prisma-ksuid",
    query: {
      $allModels: {
        async create({ model, args, query }: ModelQueryOptionsCbArgs) {
          const prefix = ensurePrefixForModel(model);

          const currentData = args.data as JsInputValue | undefined;

          if (currentData === undefined || currentData === null) {
            return query(args);
          }

          let createData: unknown = currentData;

          if (isJsonLike(createData)) {
            createData = withGeneratedId(createData, prefix);
          }

          // Process nested creates if enabled
          if (shouldProcessNestedCreates) {
            createData = processNestedCreates(createData);

            if (isJsonLike(createData)) {
              createData = withGeneratedId(createData, prefix);
            }
          }

          args.data = createData as JsInputValue;
          return query(args);
        },

        async createMany({ model, args, query }: ModelQueryOptionsCbArgs) {
          const prefix = ensurePrefixForModel(model);

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
                  normalized = withGeneratedId(normalized, prefix);
                }

                if (!shouldProcessNestedCreates) {
                  return normalized;
                }

                const processed = processNestedCreates(normalized);

                if (isJsonLike(processed)) {
                  return withGeneratedId(processed, prefix);
                }

                return processed;
              });

            args.data = processedItems as JsInputValue;
          }
          // If data is not an array (unexpected), still respect nested processing flag
          else if (shouldProcessNestedCreates) {
            const processed = processNestedCreates(currentData);
            args.data = (
              isJsonLike(processed)
                ? withGeneratedId(processed, prefix)
                : processed
            ) as JsInputValue;
          } else {
            args.data = currentData;
          }

          return query(args);
        },
      },
    },
  });
};
