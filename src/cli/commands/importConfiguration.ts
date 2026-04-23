import * as fs from 'fs';
import * as path from 'path';
import { getBool, getString } from '../core/args';
import { resolveConnection } from '../core/connection';
import { createTempDir, printLogFile, runDesignerAndPrintResult, safeRemoveDir, writeUtf8BomLines } from '../core/onecCommon';
import { resolveConfigDir } from '../core/projectLayout';
import { CliArgs } from '../core/types';

export async function importConfiguration(args: CliArgs): Promise<number> {
  const projectRoot = path.resolve(getString(args, 'ProjectRoot', process.cwd()));
  const mode = getString(args, 'Mode', 'Full');
  const format = getString(args, 'Format', 'Hierarchical');
  const target = getString(args, 'Target', 'cf');
  const extension = getString(args, 'Extension', '');
  const files = getString(args, 'Files', '');
  const listFileFromArgs = getString(args, 'ListFile', '');
  const configDir = getString(args, 'ConfigDir', '') || resolveConfigDir(projectRoot, target === 'cfe' ? 'cfe' : 'cf', extension);
  const allExtensions = getBool(args, 'AllExtensions');
  const verbose = getBool(args, 'Verbose');
  const connection = resolveConnection(args);

  if (!['Full', 'Partial'].includes(mode)) {
    throw new Error('Error: -Mode must be Full or Partial');
  }
  if (!['Hierarchical', 'Plain'].includes(format)) {
    throw new Error('Error: -Format must be Hierarchical or Plain');
  }
  if (!fs.existsSync(configDir)) {
    throw new Error(`Error: config directory not found: ${configDir}`);
  }
  if (mode === 'Partial' && !files.trim() && !listFileFromArgs.trim()) {
    throw new Error('Error: -Files or -ListFile required for Partial mode');
  }
  if (target !== 'cfe' && isConfigurationOnSupport(configDir)) {
    throw new Error('Обновление основной конфигурации запрещено: конфигурация на поддержке');
  }

  const tempDir = createTempDir('db_load_xml_');
  try {
    console.log('Загрузка исходников');
    const designerArgs: string[] = ['/LoadConfigFromFiles', configDir];
    if (mode !== 'Full') {
      let listFile = listFileFromArgs;
      if (listFile) {
        if (!fs.existsSync(listFile)) {
          throw new Error(`Error: list file not found: ${listFile}`);
        }
      } else {
        const fileList = files.split(',').map((item) => item.trim()).filter(Boolean);
        listFile = path.join(tempDir, 'load_list.txt');
        writeUtf8BomLines(listFile, fileList);
        if (verbose) {
          console.log(`Files to load: ${fileList.length}`);
        }
      }
      designerArgs.push('-listFile', listFile, '-partial', '-updateConfigDumpInfo');
    }

    designerArgs.push('-Format', format);
    if (target === 'cfe' || extension) {
      designerArgs.push('-Extension', extension);
    } else if (allExtensions) {
      designerArgs.push('-AllExtensions');
    }

    const outFile = path.join(tempDir, 'load_log.txt');
    designerArgs.push('/Out', outFile, '/DisableStartupDialogs');

    const exitCode = await runDesignerAndPrintResult(
      connection,
      designerArgs,
      'Загрузка завершена',
      'Error loading configuration'
    );
    if (verbose) {
      printLogFile(outFile);
    }
    return exitCode;
  } finally {
    safeRemoveDir(tempDir);
  }
}

function isConfigurationOnSupport(configDir: string): boolean {
  return fs.existsSync(path.join(configDir, 'Ext', 'ParentConfigurations.bin'));
}
