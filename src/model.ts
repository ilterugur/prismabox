import { getConfig } from "./config";
import { processedEnums } from "./generators/enum";
import { processedInclude } from "./generators/include";
import { processedOrderBy } from "./generators/orderBy";
import { processedPlain, processedPlainMap } from "./generators/plain";
import { processedPlainInputCreate } from "./generators/plainInputCreate";
import { processedPlainInputUpdate } from "./generators/plainInputUpdate";
import {
  processedRelations,
  processedRelationsInputCreate,
  processedRelationsInputUpdate,
} from "./generators/relations";
import { processedSelect } from "./generators/select";
import {
  transformDateImportStatement,
  transformDateType,
} from "./generators/transformDate";
import { processedWhere, processedWhereUnique } from "./generators/where";
import { makeComposite } from "./generators/wrappers/composite";
import { nullableImport, nullableType } from "./generators/wrappers/nullable";
import {
  TYPEBOX_DATE_NAME,
  TYPEBOX_UINT8_ARRAY_NAME,
  typeboxCompatImportStatement,
  typeboxDateType,
  typeboxUint8ArrayType,
} from "./generators/wrappers/typeboxCompat";

export type ProcessedModel = {
  name: string;
  stringRepresentation: string;
};

function convertModelToStandalone(
  input: Pick<ProcessedModel, "name" | "stringRepresentation">,
) {
  const { exportedTypePrefix, generateTsTypes, unwrapSchemaImportName } =
    getConfig();
  const generatedName = `${exportedTypePrefix}${input.name}`;
  let exportStr = `export const ${generatedName} = ${input.stringRepresentation}\n`;
  if (generateTsTypes) {
    exportStr += `export type ${generatedName} = ${unwrapSchemaImportName}<typeof ${generatedName}>\n`;
  }
  return exportStr;
}

function typepoxImportStatement() {
  const {
    typeboxImportDependencyName,
    typeboxImportVariableName,
    generateTsTypes,
    unwrapSchemaImportName,
  } = getConfig();
  if (typeboxImportDependencyName === "typebox") {
    // typebox 1.x exposes the builder as a default export
    const typeImport = generateTsTypes
      ? `, { type ${unwrapSchemaImportName} }`
      : "";
    return `import ${typeboxImportVariableName}${typeImport} from "${
      typeboxImportDependencyName
    }"\n`;
  }

  const imports = generateTsTypes
    ? `${typeboxImportVariableName}, type ${unwrapSchemaImportName}`
    : typeboxImportVariableName;
  return `import { ${imports} } from "${
    typeboxImportDependencyName
  }"\n`;
}

export function mapAllModelsForWrite() {
  const { nullableName, transformDateName, typeboxImportDependencyName } =
    getConfig();

  const modelsPerName = new Map<
    ProcessedModel["name"],
    ProcessedModel["stringRepresentation"]
  >();

  const process = (models: ProcessedModel[], suffix: string) => {
    for (const processedModel of models) {
      const standalone = convertModelToStandalone({
        ...processedModel,
        name: `${processedModel.name}${suffix}`,
      });
      const current = modelsPerName.get(processedModel.name);
      if (current) {
        modelsPerName.set(processedModel.name, `${current}\n${standalone}`);
      } else {
        modelsPerName.set(processedModel.name, standalone);
      }
    }
  };

  process(processedEnums, "");
  process(processedPlain, "Plain");
  process(processedRelations, "Relations");
  process(processedPlainInputCreate, "PlainInputCreate");
  process(processedPlainInputUpdate, "PlainInputUpdate");
  process(processedRelationsInputCreate, "RelationsInputCreate");
  process(processedRelationsInputUpdate, "RelationsInputUpdate");
  process(processedWhere, "Where");
  process(processedWhereUnique, "WhereUnique");
  process(processedSelect, "Select");
  process(processedInclude, "Include");
  process(processedOrderBy, "OrderBy");

  const relationsSet = new Set(processedRelations.map((e) => e.name));
  const relationsInputCreateSet = new Set(
    processedRelationsInputCreate.map((e) => e.name),
  );
  const relationsInputUpdateSet = new Set(
    processedRelationsInputUpdate.map((e) => e.name),
  );

  for (const [key, value] of modelsPerName) {
    const hasPlain = processedPlainMap.has(key);
    const hasRelations = relationsSet.has(key);
    let composite: string;
    if (hasPlain && hasRelations) {
      composite = makeComposite(
        [`${key}Plain`, `${key}Relations`],
        [false, getConfig().optionalRelations],
      );
    } else if (hasPlain) {
      composite = `${key}Plain`;
    } else if (hasRelations) {
      composite = `${key}Relations`;
    } else {
      continue;
    }

    modelsPerName.set(
      key,
      `${value}\n${convertModelToStandalone({
        name: key,
        stringRepresentation: composite,
      })}`,
    );
  }

  for (const [key, value] of modelsPerName) {
    if (relationsInputCreateSet.has(key)) {
      const composite = makeComposite([
        `${key}PlainInputCreate`,
        `${key}RelationsInputCreate`,
      ]);
      modelsPerName.set(
        key,
        `${value}\n${convertModelToStandalone({
          name: `${key}InputCreate`,
          stringRepresentation: composite,
        })}`,
      );
    }
  }

  for (const [key, value] of modelsPerName) {
    if (relationsInputUpdateSet.has(key)) {
      const composite = makeComposite([
        `${key}PlainInputUpdate`,
        `${key}RelationsInputUpdate`,
      ]);
      modelsPerName.set(
        key,
        `${value}\n${convertModelToStandalone({
          name: `${key}InputUpdate`,
          stringRepresentation: composite,
        })}`,
      );
    }
  }

  for (const [key, value] of modelsPerName) {
    modelsPerName.set(
      key,
      `${typepoxImportStatement()}\n${transformDateImportStatement()}\n${nullableImport()}\n${typeboxCompatImportStatement()}\n${value}`,
    );
  }

  modelsPerName.set(nullableName, nullableType());
  modelsPerName.set(transformDateName, transformDateType());
  if (typeboxImportDependencyName === "typebox") {
    modelsPerName.set(TYPEBOX_DATE_NAME, typeboxDateType());
    modelsPerName.set(TYPEBOX_UINT8_ARRAY_NAME, typeboxUint8ArrayType());
  }

  return modelsPerName;
}
