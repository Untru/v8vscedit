/**
 * Удаление объектов метаданных из конфигурации 1С.
 * Удаляет файлы объекта и ссылку из Configuration.xml.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Удалить объект метаданных из конфигурации.
 * @param configXmlPath — путь к Configuration.xml
 * @param metaType — тип объекта (например "Catalog")
 * @param objectName — имя объекта (например "МойСправочник")
 * @param folderName — имя папки (например "Catalogs")
 * @returns true если удалено успешно
 */
export function deleteMetadataObject(
  configXmlPath: string,
  metaType: string,
  objectName: string,
  folderName: string
): { success: boolean; error?: string } {
  const configRoot = path.dirname(configXmlPath);

  // 1. Удалить ссылку из Configuration.xml
  try {
    let xml = fs.readFileSync(configXmlPath, 'utf-8');

    // Ищем строку <MetaType>ObjectName</MetaType> в <ChildObjects>
    // Формат: <Catalog>МойСправочник</Catalog>
    const tagRegex = new RegExp(
      `\\s*<${metaType}>${escapeRegex(objectName)}</${metaType}>`,
      'g'
    );

    const newXml = xml.replace(tagRegex, '');
    if (newXml === xml) {
      return {
        success: false,
        error: `Объект <${metaType}>${objectName}</${metaType}> не найден в Configuration.xml`,
      };
    }

    fs.writeFileSync(configXmlPath, newXml, 'utf-8');
  } catch (err) {
    return {
      success: false,
      error: `Ошибка обновления Configuration.xml: ${err}`,
    };
  }

  // 2. Удалить папку объекта
  const objectDir = path.join(configRoot, folderName, objectName);
  try {
    if (fs.existsSync(objectDir)) {
      fs.rmSync(objectDir, { recursive: true, force: true });
    }
  } catch (err) {
    // Не критично — ссылка уже удалена из Configuration.xml
    return {
      success: true,
      error: `Ссылка удалена из Configuration.xml, но не удалось удалить папку: ${err}`,
    };
  }

  // 3. Удалить XML-файл объекта если он на верхнем уровне (для простых объектов)
  const objectXml = path.join(configRoot, folderName, `${objectName}.xml`);
  try {
    if (fs.existsSync(objectXml)) {
      fs.unlinkSync(objectXml);
    }
  } catch {
    // Не критично
  }

  return { success: true };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
