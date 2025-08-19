import { generateKSUID } from "./util/ksuid";
import { Prisma } from "@prisma/client";

type PrefixMap = Record<string, string>;
type PrefixGenerator = (model: string) => string;

interface KsuidExtensionOptions {
  prefixMap: PrefixMap;
  prefixFn?: PrefixGenerator;
  processNestedCreates?: boolean;
}

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

  /**
   * Recursively process nested create operations in data
   */
  const processNestedCreates = (data: any, parentModel?: string): any => {
    if (!data || typeof data !== "object") {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => processNestedCreates(item, parentModel));
    }

    const processed = { ...data };

    // Look for nested create operations
    for (const [key, value] of Object.entries(processed)) {
      if (value && typeof value === "object") {
        // Check if this is a nested create operation
        if ("create" in value && typeof value.create === "object") {
          const nestedCreateData = value.create;

          // Try to infer the model name from the key
          let modelName = key.charAt(0).toUpperCase() + key.slice(1);
          if (modelName.endsWith("s") && modelName.length > 1) {
            modelName = modelName.slice(0, -1);
          }

          const prefix = getPrefix(modelName);
          if (prefix) {
            // Process the nested create data
            const processedNestedData = processNestedCreates(
              nestedCreateData,
              modelName,
            );

            // Add KSUID if not present
            if (Array.isArray(processedNestedData)) {
              processedNestedData.forEach((item) => {
                if (!item.id || item.id === "") {
                  item.id = generateKSUID(prefix);
                }
              });
            } else if (
              !processedNestedData.id ||
              processedNestedData.id === ""
            ) {
              processedNestedData.id = generateKSUID(prefix);
            }

            processed[key] = { ...value, create: processedNestedData };
          }
        }
        // Check for createMany nested operations
        else if (
          "createMany" in value &&
          value.createMany &&
          typeof value.createMany === "object" &&
          "data" in value.createMany
        ) {
          const nestedCreateManyData = value.createMany.data;

          let modelName = key.charAt(0).toUpperCase() + key.slice(1);
          if (modelName.endsWith("s") && modelName.length > 1) {
            modelName = modelName.slice(0, -1);
          }

          const prefix = getPrefix(modelName);
          if (prefix && Array.isArray(nestedCreateManyData)) {
            const processedData = nestedCreateManyData.map((item) => {
              const processedItem = processNestedCreates(item, modelName);
              if (!processedItem.id || processedItem.id === "") {
                processedItem.id = generateKSUID(prefix);
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
        }
        // Recursively process other nested objects
        else {
          processed[key] = processNestedCreates(value, parentModel);
        }
      }
    }

    return processed;
  };

  return Prisma.defineExtension({
    name: "prisma-ksuid",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const prefix = getPrefix(model);

          // Validate that we have a non-empty prefix for this model
          if (!prefix || prefix.length === 0) {
            throw new Error(
              `Prefix not defined or invalid for model "${model}".`,
            );
          }

          const data = args.data as Record<string, unknown>;

          // Only add an ID if data is an object and doesn't already have a meaningful ID
          if (
            typeof data === "object" &&
            !Array.isArray(data) &&
            (!data.id || data.id === "")
          ) {
            data.id = generateKSUID(prefix);
          }

          // Process nested creates if enabled
          if (shouldProcessNestedCreates) {
            args.data = processNestedCreates(data, model);
          }

          return query(args);
        },

        async createMany({ model, args, query }) {
          const prefix = getPrefix(model);

          // Validate that we have a non-empty prefix for this model
          if (!prefix || prefix.length === 0) {
            throw new Error(
              `Prefix not defined or invalid for model "${model}".`,
            );
          }

          if (Array.isArray(args.data)) {
            args.data = args.data.map((item) => {
              // Only add an ID if the item is an object, not null/undefined, and doesn't already have a meaningful ID
              if (
                item &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                (!("id" in item) ||
                  item.id === "" ||
                  item.id === null ||
                  item.id === undefined)
              ) {
                (item as any).id = generateKSUID(prefix);
              }

              // Process nested creates in each item if enabled
              if (shouldProcessNestedCreates) {
                return processNestedCreates(item, model);
              }

              return item;
            });
          }

          return query(args);
        },
      },
    },
  });
};
