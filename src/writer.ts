import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateBarrelFile } from "./barrel";
import { getConfig } from "./config";
import { debug } from "./debug";
import { format } from "./format";
import { mapAllModelsForWrite } from "./model";

export async function write() {
  const mappings = Array.from(mapAllModelsForWrite().entries());
  const { output, disableFormatting } = getConfig();
  debug(`write: ${mappings.length} files`);

  const maybeFormat = (content: string) =>
    disableFormatting ? content : format(content);

  // Sequential writes (instead of Promise.all) to avoid memory/CPU spikes
  // when generating very large schemas inside resource-constrained containers.
  for (let i = 0; i < mappings.length; i++) {
    const [name, content] = mappings[i];
    debug(`  [${i + 1}/${mappings.length}] ${name}.ts`);
    await writeFile(join(output, `${name}.ts`), await maybeFormat(content));
  }

  debug("writing barrel.ts");
  await writeFile(
    join(output, "barrel.ts"),
    await maybeFormat(generateBarrelFile(mappings.map(([key]) => key))),
  );
}
