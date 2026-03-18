# BSL tree-sitter грамматика (кастомная сборка)

Форк `tree-sitter-bsl` с расширенным правилом для дата-литералов.

## Изменение по сравнению с оригиналом

**`grammar.js`, правило `date`:**
```js
// было (node_modules/tree-sitter-bsl):
date: ($) => /'\d{8,14}'/,

// стало (поддержка любого содержимого в одинарных кавычках):
date: ($) => /'[^'\n]*'/,
```

Это позволяет корректно распознавать `'0001-01-01'`, `'2023-01-15'` и любые
другие форматы дат, а не только компактный `'YYYYMMDD'`.

## Пересборка WASM

Если нужно обновить грамматику:

```bash
# 1. Внести изменения в grammar.js
# 2. Запустить из папки node_modules/tree-sitter-bsl (или форка):
npx --yes tree-sitter-cli generate
npx --yes tree-sitter-cli build --wasm --output tree-sitter-bsl.wasm .

# 3. Скопировать результат сюда:
copy tree-sitter-bsl.wasm grammars/bsl/tree-sitter-bsl.wasm
```

Webpack подбирает файл из `grammars/bsl/` — не из `node_modules`.
