import { generateTypeboxOptions } from "../../annotations/options";
import { getConfig } from "../../config";

function makePartial(input: string) {
  return `${getConfig().typeboxImportVariableName}.Partial(${input})`;
}

export function makeComposite(inputModels: string[], partial: boolean[] = []) {
  const {
    typeboxImportDependencyName,
    typeboxImportVariableName,
    exportedTypePrefix,
  } = getConfig();

  const members = inputModels
    .map((model, i) => {
      const modelStr = `${exportedTypePrefix}${model}`;
      return partial[i] ? makePartial(modelStr) : modelStr;
    })
    .join(",");

  if (typeboxImportDependencyName === "typebox") {
    return `${typeboxImportVariableName}.Evaluate(${typeboxImportVariableName}.Intersect([${members}], ${generateTypeboxOptions()}))\n`;
  }

  return `${typeboxImportVariableName}.Composite([${members}], ${generateTypeboxOptions()})\n`;
}
