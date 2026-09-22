import fs from 'node:fs/promises';
import { SpreadsheetFile } from '@oai/artifact-tool';
const dir = 'C:/Users/rdpr1/OneDrive/Escritorio/next-js/outputs/01a0bd1b-5f14-7fc2-9755-76140e7e0de4';
const file = await fs.readFile(`${dir}/Asignaciones_directiva_2022-2026_revisado.xlsx`);
const workbook = await SpreadsheetFile.importXlsx(new Uint8Array(file));
const preview = await workbook.render({sheetName:'Asignaciones',range:'A218:E239',scale:1.2,format:'png'});
await fs.writeFile(`${dir}/review-v2.png`,new Uint8Array(await preview.arrayBuffer()));
const table = await workbook.inspect({kind:'table',range:'Asignaciones!A218:E239',include:'values',table_max_rows:30,table_max_cols:8});
console.log(JSON.stringify(table).slice(0,10000));
