# Дорожная карта v8vscedit

Дорожная карта развития VS Code расширения для редактирования конфигураций 1С:Предприятие.

## Текущее состояние (v0.2.2)

| Область | Что есть |
|---------|----------|
| Дерево метаданных | 47 типов, навигация, поддержка CF + CFE, статус поддержки |
| BSL Language Server | Подсветка, автодополнение (ключевые слова, общие модули, метаданные-префиксы), Go to Definition (локальный), Document Symbols, Folding, Hover, Diagnostics (tree-sitter) |
| Файловые операции | Виртуальная ФС `onec://`, readonly для объектов на поддержке |
| Расширения | Выгрузка/загрузка/обновление через vrunner |
| Внешний LSP | Поддержка bsl-analyzer (180+ диагностик) |

---

## Фаза 1: Фундамент — LSP и навигация

Усиление базовых возможностей редактора кода, которые используются каждый день.

| # | Issue | Область | Приоритет |
|---|-------|---------|-----------|
| 1 | [Поиск по дереву метаданных](https://github.com/Untru/v8vscedit/issues/1) | tree | Высокий |
| 2 | [Go to Definition — кросс-модульный](https://github.com/Untru/v8vscedit/issues/2) | lsp | Высокий |
| 3 | [Find All References](https://github.com/Untru/v8vscedit/issues/3) | lsp | Высокий |
| 4 | [Автодополнение реквизитов и полей](https://github.com/Untru/v8vscedit/issues/4) | lsp | Высокий |
| 5 | [Rename Symbol](https://github.com/Untru/v8vscedit/issues/5) | lsp | Средний |
| 6 | [Сниппеты и шаблоны BSL](https://github.com/Untru/v8vscedit/issues/6) | lsp | Средний |
| 8 | [Глобальный поиск по коду](https://github.com/Untru/v8vscedit/issues/8) | lsp | Средний |
| 22 | [Синтаксис-помощник](https://github.com/Untru/v8vscedit/issues/22) | lsp | Высокий |
| 27 | [Форматирование кода BSL](https://github.com/Untru/v8vscedit/issues/27) | lsp | Средний |
| 35 | [Workspace Symbols](https://github.com/Untru/v8vscedit/issues/35) | lsp | Средний |
| 36 | [Signature Help](https://github.com/Untru/v8vscedit/issues/36) | lsp | Средний |
| 25 | [Редактор форм: парсер Form.xml](https://github.com/Untru/v8vscedit/issues/25) | forms | Средний |
| 28 | [Редактор форм: CustomEditorProvider](https://github.com/Untru/v8vscedit/issues/28) | forms | Средний |

---

## Фаза 2: Редактирование и навигация

Полноценное редактирование метаданных и форм без выхода из VS Code.

| # | Issue | Область | Приоритет |
|---|-------|---------|-----------|
| 9 | [Редактирование свойств объектов](https://github.com/Untru/v8vscedit/issues/9) | tree | Высокий |
| 10 | [Создание объектов метаданных](https://github.com/Untru/v8vscedit/issues/10) | tree | Высокий |
| 11 | [Drag & Drop в дереве](https://github.com/Untru/v8vscedit/issues/11) | tree | Низкий |
| 12 | [Удаление объектов метаданных](https://github.com/Untru/v8vscedit/issues/12) | tree | Средний |
| 13 | [Редактор запросов 1С](https://github.com/Untru/v8vscedit/issues/13) | query | Высокий |
| 15 | [Просмотрщик форм](https://github.com/Untru/v8vscedit/issues/15) | forms | Высокий |
| 20 | [Работа с EPF/ERF](https://github.com/Untru/v8vscedit/issues/20) | epf | Высокий |
| 21 | [Extended Diagnostics](https://github.com/Untru/v8vscedit/issues/21) | lsp | Средний |
| 23 | [Управление подсистемами](https://github.com/Untru/v8vscedit/issues/23) | tree | Средний |
| 24 | [Управление ролями](https://github.com/Untru/v8vscedit/issues/24) | tree | Средний |
| 26 | [Code Actions и Quick Fix](https://github.com/Untru/v8vscedit/issues/26) | lsp | Средний |
| 29 | [Загрузка/выгрузка конфигурации](https://github.com/Untru/v8vscedit/issues/29) | admin | Высокий |
| 30 | [Редактор форм: drag-and-drop](https://github.com/Untru/v8vscedit/issues/30) | forms | Средний |
| 31 | [Редактор форм: сериализация XML](https://github.com/Untru/v8vscedit/issues/31) | forms | Средний |
| 32 | [Редактор форм: свойства и элементы](https://github.com/Untru/v8vscedit/issues/32) | forms | Средний |
| 33 | [Smart Git Diff для 1С](https://github.com/Untru/v8vscedit/issues/33) | git | Средний |
| 39 | [Breadcrumbs и Code Lens](https://github.com/Untru/v8vscedit/issues/39) | lsp | Низкий |
| 40 | [Inlay Hints](https://github.com/Untru/v8vscedit/issues/40) | lsp | Низкий |
| 45 | [Копирование объектов](https://github.com/Untru/v8vscedit/issues/45) | tree | Средний |
| 7 | [Иерархия вызовов](https://github.com/Untru/v8vscedit/issues/7) | lsp | Средний |

---

## Фаза 3: Инструменты разработчика

Специализированные инструменты, которые есть в Конфигураторе/EDT.

| # | Issue | Область | Приоритет |
|---|-------|---------|-----------|
| 14 | [Консоль запросов](https://github.com/Untru/v8vscedit/issues/14) | query | Высокий |
| 16 | [Просмотрщик СКД](https://github.com/Untru/v8vscedit/issues/16) | query | Средний |
| 17 | [Отладка BSL (DAP)](https://github.com/Untru/v8vscedit/issues/17) | debug | Высокий |
| 18 | [Сравнение конфигураций](https://github.com/Untru/v8vscedit/issues/18) | compare | Средний |
| 19 | [MXL-макеты](https://github.com/Untru/v8vscedit/issues/19) | mxl | Средний |
| 34 | [Редактор форм: undo/redo, валидация](https://github.com/Untru/v8vscedit/issues/34) | forms | Средний |
| 38 | [Управление базами данных](https://github.com/Untru/v8vscedit/issues/38) | admin | Средний |
| 41 | [Заимствование в расширение](https://github.com/Untru/v8vscedit/issues/41) | tree | Средний |
| 43 | [Тестирование YaXUnit](https://github.com/Untru/v8vscedit/issues/43) | debug | Средний |
| 44 | [HTTP-сервисы: навигация и тест](https://github.com/Untru/v8vscedit/issues/44) | tree | Низкий |

---

## Фаза 4: Продвинутые возможности

Возможности уровня IDE, которых нет даже в EDT.

| # | Issue | Область | Приоритет |
|---|-------|---------|-----------|
| 37 | [Замер производительности](https://github.com/Untru/v8vscedit/issues/37) | debug | Средний |
| 42 | [Журнал регистрации](https://github.com/Untru/v8vscedit/issues/42) | admin | Низкий |

---

## Сравнение с Конфигуратором и EDT

| Возможность | Конфигуратор | EDT | v8vscedit сейчас | Целевая фаза |
|-------------|:---:|:---:|:---:|:---:|
| Дерево метаданных | + | ++ | + | 1-2 |
| Подсветка BSL | + | ++ | ++ | - |
| Автодополнение | + | ++ | ~ | 1 |
| Go to Definition | ~ | ++ | ~ | 1 |
| Find References | ~ | ++ | - | 1 |
| Рефакторинг | - | + | - | 2 |
| Синтаксис-помощник | ++ | ++ | - | 1 |
| Редактор форм | ++ | + | - | 1-3 |
| Редактор запросов | ++ | + | - | 2 |
| Консоль запросов | ++ | - | - | 3 |
| Отладка | ++ | ++ | - | 3 |
| Профилирование | + | ++ | - | 4 |
| Сравнение конфигураций | ++ | + | - | 3 |
| Git интеграция | - | ++ | ~ | 2 |
| Тестирование | - | ++ | - | 3 |
| MXL-макеты | ++ | ~ | - | 3 |
| EPF/ERF | ++ | ~ | - | 2 |
| Администрирование | ++ | ~ | - | 3-4 |
| Расширения (CFE) | ~ | ++ | + | 3 |
| HTTP-сервисы | + | + | ~ | 3 |

Условные обозначения: `++` отлично, `+` хорошо, `~` базово, `-` нет
