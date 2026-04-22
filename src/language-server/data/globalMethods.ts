export interface ParamInfo {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

export interface GlobalMethodInfo {
  nameRu: string;
  nameEn: string;
  description: string;
  params: ParamInfo[];
  returnType?: string;
  isFunction: boolean;
  category: string;
}

export const GLOBAL_METHODS: GlobalMethodInfo[] = [
  // ── Строковые функции ──────────────────────────────────────────────
  {
    nameRu: 'СтрДлина', nameEn: 'StrLen', category: 'Строковые', isFunction: true,
    description: 'Получает количество символов в строке.',
    returnType: 'Число',
    params: [{ name: 'Строка', type: 'Строка', description: 'Исходная строка' }],
  },
  {
    nameRu: 'СтрНайти', nameEn: 'StrFind', category: 'Строковые', isFunction: true,
    description: 'Находит вхождение подстроки в строке.',
    returnType: 'Число',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'ПодстрокаПоиска', type: 'Строка', description: 'Искомая подстрока' },
      { name: 'НаправлениеПоиска', type: 'НаправлениеПоиска', description: 'Направление поиска', optional: true },
      { name: 'НачальнаяПозиция', type: 'Число', description: 'Позиция начала поиска', optional: true },
      { name: 'НомерВхождения', type: 'Число', description: 'Номер искомого вхождения', optional: true },
    ],
  },
  {
    nameRu: 'Лев', nameEn: 'Left', category: 'Строковые', isFunction: true,
    description: 'Получает левые символы строки.',
    returnType: 'Строка',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'ЧислоСимволов', type: 'Число', description: 'Количество символов' },
    ],
  },
  {
    nameRu: 'Прав', nameEn: 'Right', category: 'Строковые', isFunction: true,
    description: 'Получает правые символы строки.',
    returnType: 'Строка',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'ЧислоСимволов', type: 'Число', description: 'Количество символов' },
    ],
  },
  {
    nameRu: 'Сред', nameEn: 'Mid', category: 'Строковые', isFunction: true,
    description: 'Получает подстроку начиная с указанной позиции.',
    returnType: 'Строка',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'НачальнаяПозиция', type: 'Число', description: 'Позиция начала (нумерация с 1)' },
      { name: 'ЧислоСимволов', type: 'Число', description: 'Количество символов', optional: true },
    ],
  },
  {
    nameRu: 'СокрЛ', nameEn: 'TrimL', category: 'Строковые', isFunction: true,
    description: 'Отсекает пробелы слева.',
    returnType: 'Строка',
    params: [{ name: 'Строка', type: 'Строка', description: 'Исходная строка' }],
  },
  {
    nameRu: 'СокрП', nameEn: 'TrimR', category: 'Строковые', isFunction: true,
    description: 'Отсекает пробелы справа.',
    returnType: 'Строка',
    params: [{ name: 'Строка', type: 'Строка', description: 'Исходная строка' }],
  },
  {
    nameRu: 'СокрЛП', nameEn: 'TrimAll', category: 'Строковые', isFunction: true,
    description: 'Отсекает пробелы слева и справа.',
    returnType: 'Строка',
    params: [{ name: 'Строка', type: 'Строка', description: 'Исходная строка' }],
  },
  {
    nameRu: 'ВРег', nameEn: 'Upper', category: 'Строковые', isFunction: true,
    description: 'Преобразует строку в верхний регистр.',
    returnType: 'Строка',
    params: [{ name: 'Строка', type: 'Строка', description: 'Исходная строка' }],
  },
  {
    nameRu: 'НРег', nameEn: 'Lower', category: 'Строковые', isFunction: true,
    description: 'Преобразует строку в нижний регистр.',
    returnType: 'Строка',
    params: [{ name: 'Строка', type: 'Строка', description: 'Исходная строка' }],
  },
  {
    nameRu: 'ТРег', nameEn: 'Title', category: 'Строковые', isFunction: true,
    description: 'Преобразует строку в титульный регистр (первая буква каждого слова заглавная).',
    returnType: 'Строка',
    params: [{ name: 'Строка', type: 'Строка', description: 'Исходная строка' }],
  },
  {
    nameRu: 'СтрЗаменить', nameEn: 'StrReplace', category: 'Строковые', isFunction: true,
    description: 'Заменяет все вхождения подстроки в строке на другую подстроку.',
    returnType: 'Строка',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'ПодстрокаПоиска', type: 'Строка', description: 'Искомая подстрока' },
      { name: 'ПодстрокаЗамены', type: 'Строка', description: 'Подстрока замены' },
    ],
  },
  {
    nameRu: 'СтрЧислоВхождений', nameEn: 'StrOccurrenceCount', category: 'Строковые', isFunction: true,
    description: 'Подсчитывает количество вхождений подстроки в строку.',
    returnType: 'Число',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'ПодстрокаПоиска', type: 'Строка', description: 'Искомая подстрока' },
    ],
  },
  {
    nameRu: 'СтрЧислоСтрок', nameEn: 'StrLineCount', category: 'Строковые', isFunction: true,
    description: 'Получает количество строк в многострочной строке.',
    returnType: 'Число',
    params: [{ name: 'Строка', type: 'Строка', description: 'Многострочная строка' }],
  },
  {
    nameRu: 'СтрПолучитьСтроку', nameEn: 'StrGetLine', category: 'Строковые', isFunction: true,
    description: 'Получает строку многострочной строки по номеру.',
    returnType: 'Строка',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Многострочная строка' },
      { name: 'НомерСтроки', type: 'Число', description: 'Номер строки (нумерация с 1)' },
    ],
  },
  {
    nameRu: 'СтрСоединить', nameEn: 'StrConcat', category: 'Строковые', isFunction: true,
    description: 'Соединяет массив строк в одну строку с указанным разделителем.',
    returnType: 'Строка',
    params: [
      { name: 'Строки', type: 'Массив', description: 'Массив строк для соединения' },
      { name: 'Разделитель', type: 'Строка', description: 'Разделитель между строками', optional: true },
    ],
  },
  {
    nameRu: 'СтрРазделить', nameEn: 'StrSplit', category: 'Строковые', isFunction: true,
    description: 'Разделяет строку на части по указанному разделителю.',
    returnType: 'Массив',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'Разделитель', type: 'Строка', description: 'Строка-разделитель' },
      { name: 'ВключатьПустые', type: 'Булево', description: 'Включать ли пустые строки', optional: true },
    ],
  },
  {
    nameRu: 'СтрНачинаетсяС', nameEn: 'StrStartsWith', category: 'Строковые', isFunction: true,
    description: 'Проверяет, начинается ли строка с указанной подстроки.',
    returnType: 'Булево',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Проверяемая строка' },
      { name: 'СтрокаПоиска', type: 'Строка', description: 'Искомое начало' },
    ],
  },
  {
    nameRu: 'СтрЗаканчиваетсяНа', nameEn: 'StrEndsWith', category: 'Строковые', isFunction: true,
    description: 'Проверяет, заканчивается ли строка указанной подстрокой.',
    returnType: 'Булево',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Проверяемая строка' },
      { name: 'СтрокаПоиска', type: 'Строка', description: 'Искомое окончание' },
    ],
  },
  {
    nameRu: 'Символ', nameEn: 'Char', category: 'Строковые', isFunction: true,
    description: 'Получает символ по коду Unicode.',
    returnType: 'Строка',
    params: [{ name: 'КодСимвола', type: 'Число', description: 'Код символа Unicode' }],
  },
  {
    nameRu: 'КодСимвола', nameEn: 'CharCode', category: 'Строковые', isFunction: true,
    description: 'Получает код Unicode символа в строке.',
    returnType: 'Число',
    params: [
      { name: 'Строка', type: 'Строка', description: 'Исходная строка' },
      { name: 'НомерСимвола', type: 'Число', description: 'Номер символа (нумерация с 1)', optional: true },
    ],
  },

  // ── Математические функции ─────────────────────────────────────────
  {
    nameRu: 'Цел', nameEn: 'Int', category: 'Математические', isFunction: true,
    description: 'Получает целую часть числа (отбрасывает дробную).',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Исходное число' }],
  },
  {
    nameRu: 'Окр', nameEn: 'Round', category: 'Математические', isFunction: true,
    description: 'Округляет число до указанного количества знаков после запятой.',
    returnType: 'Число',
    params: [
      { name: 'Число', type: 'Число', description: 'Округляемое число' },
      { name: 'РазрядностьДробнойЧасти', type: 'Число', description: 'Число знаков дробной части', optional: true },
      { name: 'РежимОкругления', type: 'РежимОкругления', description: 'Режим округления (15От5 или 15До0)', optional: true },
    ],
  },
  {
    nameRu: 'Макс', nameEn: 'Max', category: 'Математические', isFunction: true,
    description: 'Определяет максимальное значение из набора.',
    returnType: 'Произвольный',
    params: [
      { name: 'Значение1', type: 'Произвольный', description: 'Первое сравниваемое значение' },
      { name: 'Значение2', type: 'Произвольный', description: 'Второе сравниваемое значение' },
    ],
  },
  {
    nameRu: 'Мин', nameEn: 'Min', category: 'Математические', isFunction: true,
    description: 'Определяет минимальное значение из набора.',
    returnType: 'Произвольный',
    params: [
      { name: 'Значение1', type: 'Произвольный', description: 'Первое сравниваемое значение' },
      { name: 'Значение2', type: 'Произвольный', description: 'Второе сравниваемое значение' },
    ],
  },
  {
    nameRu: 'Лог', nameEn: 'Log', category: 'Математические', isFunction: true,
    description: 'Вычисляет натуральный логарифм числа.',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Число, логарифм которого вычисляется' }],
  },
  {
    nameRu: 'Лог10', nameEn: 'Log10', category: 'Математические', isFunction: true,
    description: 'Вычисляет десятичный логарифм числа.',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Число, логарифм которого вычисляется' }],
  },
  {
    nameRu: 'Sin', nameEn: 'Sin', category: 'Математические', isFunction: true,
    description: 'Вычисляет синус угла в радианах.',
    returnType: 'Число',
    params: [{ name: 'Угол', type: 'Число', description: 'Угол в радианах' }],
  },
  {
    nameRu: 'Cos', nameEn: 'Cos', category: 'Математические', isFunction: true,
    description: 'Вычисляет косинус угла в радианах.',
    returnType: 'Число',
    params: [{ name: 'Угол', type: 'Число', description: 'Угол в радианах' }],
  },
  {
    nameRu: 'Tan', nameEn: 'Tan', category: 'Математические', isFunction: true,
    description: 'Вычисляет тангенс угла в радианах.',
    returnType: 'Число',
    params: [{ name: 'Угол', type: 'Число', description: 'Угол в радианах' }],
  },
  {
    nameRu: 'ASin', nameEn: 'ASin', category: 'Математические', isFunction: true,
    description: 'Вычисляет арксинус числа.',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Значение от -1 до 1' }],
  },
  {
    nameRu: 'ACos', nameEn: 'ACos', category: 'Математические', isFunction: true,
    description: 'Вычисляет арккосинус числа.',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Значение от -1 до 1' }],
  },
  {
    nameRu: 'ATan', nameEn: 'ATan', category: 'Математические', isFunction: true,
    description: 'Вычисляет арктангенс числа.',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Исходное число' }],
  },
  {
    nameRu: 'Exp', nameEn: 'Exp', category: 'Математические', isFunction: true,
    description: 'Вычисляет экспоненту числа (e в степени x).',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Показатель степени' }],
  },
  {
    nameRu: 'Pow', nameEn: 'Pow', category: 'Математические', isFunction: true,
    description: 'Возводит число в степень.',
    returnType: 'Число',
    params: [
      { name: 'Основание', type: 'Число', description: 'Основание степени' },
      { name: 'Показатель', type: 'Число', description: 'Показатель степени' },
    ],
  },
  {
    nameRu: 'Sqrt', nameEn: 'Sqrt', category: 'Математические', isFunction: true,
    description: 'Вычисляет квадратный корень числа.',
    returnType: 'Число',
    params: [{ name: 'Число', type: 'Число', description: 'Исходное число (неотрицательное)' }],
  },

  // ── Дата и время ───────────────────────────────────────────────────
  {
    nameRu: 'ТекущаяДата', nameEn: 'CurrentDate', category: 'Дата и время', isFunction: true,
    description: 'Получает текущую дату и время компьютера.',
    returnType: 'Дата',
    params: [],
  },
  {
    nameRu: 'Дата', nameEn: 'Date', category: 'Дата и время', isFunction: true,
    description: 'Создает значение типа Дата из компонентов или строки.',
    returnType: 'Дата',
    params: [
      { name: 'Год', type: 'Число', description: 'Год (или строка даты в формате "ГГГГММДДЧЧммсс")' },
      { name: 'Месяц', type: 'Число', description: 'Месяц', optional: true },
      { name: 'День', type: 'Число', description: 'День', optional: true },
      { name: 'Час', type: 'Число', description: 'Час', optional: true },
      { name: 'Минута', type: 'Число', description: 'Минута', optional: true },
      { name: 'Секунда', type: 'Число', description: 'Секунда', optional: true },
    ],
  },
  {
    nameRu: 'Год', nameEn: 'Year', category: 'Дата и время', isFunction: true,
    description: 'Получает год из даты.',
    returnType: 'Число',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'Месяц', nameEn: 'Month', category: 'Дата и время', isFunction: true,
    description: 'Получает месяц из даты (1–12).',
    returnType: 'Число',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'День', nameEn: 'Day', category: 'Дата и время', isFunction: true,
    description: 'Получает день месяца из даты.',
    returnType: 'Число',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'Час', nameEn: 'Hour', category: 'Дата и время', isFunction: true,
    description: 'Получает час из даты.',
    returnType: 'Число',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'Минута', nameEn: 'Minute', category: 'Дата и время', isFunction: true,
    description: 'Получает минуту из даты.',
    returnType: 'Число',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'Секунда', nameEn: 'Second', category: 'Дата и время', isFunction: true,
    description: 'Получает секунду из даты.',
    returnType: 'Число',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'НачалоГода', nameEn: 'BegOfYear', category: 'Дата и время', isFunction: true,
    description: 'Получает дату начала года для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'НачалоМесяца', nameEn: 'BegOfMonth', category: 'Дата и время', isFunction: true,
    description: 'Получает дату начала месяца для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'НачалоДня', nameEn: 'BegOfDay', category: 'Дата и время', isFunction: true,
    description: 'Получает дату начала дня для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'НачалоКвартала', nameEn: 'BegOfQuarter', category: 'Дата и время', isFunction: true,
    description: 'Получает дату начала квартала для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'НачалоНедели', nameEn: 'BegOfWeek', category: 'Дата и время', isFunction: true,
    description: 'Получает дату начала недели для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'НачалоЧаса', nameEn: 'BegOfHour', category: 'Дата и время', isFunction: true,
    description: 'Получает дату начала часа для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'НачалоМинуты', nameEn: 'BegOfMinute', category: 'Дата и время', isFunction: true,
    description: 'Получает дату начала минуты для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'КонецГода', nameEn: 'EndOfYear', category: 'Дата и время', isFunction: true,
    description: 'Получает дату конца года для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'КонецМесяца', nameEn: 'EndOfMonth', category: 'Дата и время', isFunction: true,
    description: 'Получает дату конца месяца для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'КонецДня', nameEn: 'EndOfDay', category: 'Дата и время', isFunction: true,
    description: 'Получает дату конца дня для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'КонецКвартала', nameEn: 'EndOfQuarter', category: 'Дата и время', isFunction: true,
    description: 'Получает дату конца квартала для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'КонецНедели', nameEn: 'EndOfWeek', category: 'Дата и время', isFunction: true,
    description: 'Получает дату конца недели для указанной даты.',
    returnType: 'Дата',
    params: [{ name: 'Дата', type: 'Дата', description: 'Исходная дата' }],
  },
  {
    nameRu: 'ДобавитьМесяц', nameEn: 'AddMonth', category: 'Дата и время', isFunction: true,
    description: 'Добавляет указанное количество месяцев к дате.',
    returnType: 'Дата',
    params: [
      { name: 'Дата', type: 'Дата', description: 'Исходная дата' },
      { name: 'КоличествоМесяцев', type: 'Число', description: 'Число месяцев (может быть отрицательным)' },
    ],
  },
  {
    nameRu: 'ТекущаяДатаСеанса', nameEn: 'CurrentSessionDate', category: 'Дата и время', isFunction: true,
    description: 'Получает текущую дату сеанса (серверную дату с учётом часового пояса сеанса).',
    returnType: 'Дата',
    params: [],
  },

  // ── Преобразование типов ───────────────────────────────────────────
  {
    nameRu: 'Строка', nameEn: 'String', category: 'Преобразование типов', isFunction: true,
    description: 'Преобразует значение в строковое представление.',
    returnType: 'Строка',
    params: [{ name: 'Значение', type: 'Произвольный', description: 'Преобразуемое значение' }],
  },
  {
    nameRu: 'Число', nameEn: 'Number', category: 'Преобразование типов', isFunction: true,
    description: 'Преобразует значение в число.',
    returnType: 'Число',
    params: [{ name: 'Значение', type: 'Произвольный', description: 'Преобразуемое значение (строка или булево)' }],
  },
  {
    nameRu: 'Булево', nameEn: 'Boolean', category: 'Преобразование типов', isFunction: true,
    description: 'Преобразует значение в булево.',
    returnType: 'Булево',
    params: [{ name: 'Значение', type: 'Произвольный', description: 'Преобразуемое значение' }],
  },
  {
    nameRu: 'Формат', nameEn: 'Format', category: 'Преобразование типов', isFunction: true,
    description: 'Форматирует значение по строке форматирования.',
    returnType: 'Строка',
    params: [
      { name: 'Значение', type: 'Произвольный', description: 'Форматируемое значение' },
      { name: 'ФорматнаяСтрока', type: 'Строка', description: 'Строка форматирования (например "ЧЦ=10; ЧДЦ=2")' },
    ],
  },

  // ── Общие ──────────────────────────────────────────────────────────
  {
    nameRu: 'Тип', nameEn: 'Type', category: 'Общие', isFunction: true,
    description: 'Получает значение типа Тип по имени типа.',
    returnType: 'Тип',
    params: [{ name: 'ИмяТипа', type: 'Строка', description: 'Строковое имя типа (например "Строка", "Число")' }],
  },
  {
    nameRu: 'ТипЗнч', nameEn: 'TypeOf', category: 'Общие', isFunction: true,
    description: 'Определяет тип переданного значения.',
    returnType: 'Тип',
    params: [{ name: 'Значение', type: 'Произвольный', description: 'Значение, тип которого определяется' }],
  },
  {
    nameRu: 'Сообщить', nameEn: 'Message', category: 'Общие', isFunction: false,
    description: 'Выводит сообщение пользователю в окно сообщений.',
    params: [
      { name: 'ТекстСообщения', type: 'Строка', description: 'Текст выводимого сообщения' },
      { name: 'Статус', type: 'СтатусСообщения', description: 'Статус сообщения', optional: true },
    ],
  },
  {
    nameRu: 'ВызватьИсключение', nameEn: 'Raise', category: 'Общие', isFunction: false,
    description: 'Генерирует исключение с указанным текстом.',
    params: [{ name: 'ОписаниеОшибки', type: 'Строка', description: 'Текст описания ошибки' }],
  },
  {
    nameRu: 'ОписаниеОшибки', nameEn: 'ErrorDescription', category: 'Общие', isFunction: true,
    description: 'Получает текстовое описание текущей ошибки (внутри блока Исключение).',
    returnType: 'Строка',
    params: [],
  },
  {
    nameRu: 'ИнформацияОбОшибке', nameEn: 'ErrorInfo', category: 'Общие', isFunction: true,
    description: 'Получает объект с информацией о текущей ошибке (внутри блока Исключение).',
    returnType: 'ИнформацияОбОшибке',
    params: [],
  },
  {
    nameRu: 'ПредопределенноеЗначение', nameEn: 'PredefinedValue', category: 'Общие', isFunction: true,
    description: 'Получает предопределённое значение перечисления, справочника и т.д.',
    returnType: 'Произвольный',
    params: [{ name: 'Имя', type: 'Строка', description: 'Полное имя предопределённого значения (например "Перечисление.ВидыОперации.Покупка")' }],
  },
  {
    nameRu: 'XMLСтрока', nameEn: 'XMLString', category: 'Общие', isFunction: true,
    description: 'Преобразует значение в строковое представление XML.',
    returnType: 'Строка',
    params: [{ name: 'Значение', type: 'Произвольный', description: 'Преобразуемое значение' }],
  },
  {
    nameRu: 'XMLЗначение', nameEn: 'XMLValue', category: 'Общие', isFunction: true,
    description: 'Восстанавливает значение из строкового представления XML.',
    returnType: 'Произвольный',
    params: [
      { name: 'Тип', type: 'Тип', description: 'Тип восстанавливаемого значения' },
      { name: 'СтроковоеПредставление', type: 'Строка', description: 'Строка XML-представления' },
    ],
  },
  {
    nameRu: 'ЗначениеЗаполнено', nameEn: 'ValueIsFilled', category: 'Общие', isFunction: true,
    description: 'Проверяет, заполнено ли значение (не пустая ссылка, не 0, не пустая строка, не Неопределено).',
    returnType: 'Булево',
    params: [{ name: 'Значение', type: 'Произвольный', description: 'Проверяемое значение' }],
  },
  {
    nameRu: 'ЗаполнитьЗначенияСвойств', nameEn: 'FillPropertyValues', category: 'Общие', isFunction: false,
    description: 'Заполняет значения свойств приёмника из источника по именам свойств.',
    params: [
      { name: 'Приемник', type: 'Произвольный', description: 'Объект-приёмник' },
      { name: 'Источник', type: 'Произвольный', description: 'Объект-источник' },
      { name: 'СписокСвойств', type: 'Строка', description: 'Список имён свойств через запятую', optional: true },
      { name: 'ИсключаемыеСвойства', type: 'Строка', description: 'Список исключаемых свойств через запятую', optional: true },
    ],
  },
  {
    nameRu: 'ОписаниеТипов', nameEn: 'TypeDescription', category: 'Общие', isFunction: true,
    description: 'Создает объект ОписаниеТипов для описания допустимых типов.',
    returnType: 'ОписаниеТипов',
    params: [
      { name: 'Типы', type: 'Строка', description: 'Строка с именами типов через запятую или массив типов' },
    ],
  },
  {
    nameRu: 'НСтр', nameEn: 'NStr', category: 'Общие', isFunction: true,
    description: 'Получает строку на текущем языке из мультиязычной строки.',
    returnType: 'Строка',
    params: [
      { name: 'МультиязычнаяСтрока', type: 'Строка', description: 'Строка вида "ru=\'Текст\'; en=\'Text\'"' },
      { name: 'КодЯзыка', type: 'Строка', description: 'Код языка (например "ru")', optional: true },
    ],
  },
  {
    nameRu: 'СтрШаблон', nameEn: 'StrTemplate', category: 'Строковые', isFunction: true,
    description: 'Подставляет параметры в строку-шаблон. Параметры обозначаются как %1, %2, ... %10.',
    returnType: 'Строка',
    params: [
      { name: 'Шаблон', type: 'Строка', description: 'Строка-шаблон с подстановками %1..%10' },
      { name: 'Значение1', type: 'Произвольный', description: 'Значение для подстановки %1', optional: true },
      { name: 'Значение2', type: 'Произвольный', description: 'Значение для подстановки %2', optional: true },
      { name: 'Значение3', type: 'Произвольный', description: 'Значение для подстановки %3', optional: true },
    ],
  },
  {
    nameRu: 'ВвестиЗначение', nameEn: 'InputValue', category: 'Общие', isFunction: true,
    description: 'Открывает диалог ввода значения указанного типа.',
    returnType: 'Булево',
    params: [
      { name: 'Значение', type: 'Произвольный', description: 'Переменная для результата ввода' },
      { name: 'Подсказка', type: 'Строка', description: 'Заголовок диалога', optional: true },
      { name: 'Тип', type: 'ОписаниеТипов', description: 'Допустимые типы значения', optional: true },
    ],
  },
  {
    nameRu: 'Вопрос', nameEn: 'DoQueryBox', category: 'Общие', isFunction: true,
    description: 'Показывает диалог с вопросом и кнопками ответа.',
    returnType: 'КодВозвратаДиалога',
    params: [
      { name: 'ТекстВопроса', type: 'Строка', description: 'Текст вопроса' },
      { name: 'Кнопки', type: 'РежимДиалогаВопрос', description: 'Набор кнопок' },
      { name: 'Таймаут', type: 'Число', description: 'Таймаут в секундах', optional: true },
    ],
  },
  {
    nameRu: 'Предупреждение', nameEn: 'DoMessageBox', category: 'Общие', isFunction: false,
    description: 'Показывает предупреждение с текстом.',
    params: [
      { name: 'ТекстПредупреждения', type: 'Строка', description: 'Текст предупреждения' },
      { name: 'Таймаут', type: 'Число', description: 'Таймаут в секундах', optional: true },
    ],
  },
  {
    nameRu: 'Состояние', nameEn: 'Status', category: 'Общие', isFunction: false,
    description: 'Отображает текст в строке состояния приложения.',
    params: [
      { name: 'Текст', type: 'Строка', description: 'Текст для отображения' },
      { name: 'Прогресс', type: 'Число', description: 'Процент прогресса (0-100)', optional: true },
      { name: 'Пояснение', type: 'Строка', description: 'Дополнительный текст', optional: true },
      { name: 'Картинка', type: 'Картинка', description: 'Картинка в строке состояния', optional: true },
    ],
  },
  {
    nameRu: 'ОбработкаПрерыванияПользователя', nameEn: 'UserInterruptProcessing', category: 'Общие', isFunction: false,
    description: 'Проверяет, запросил ли пользователь прерывание длительной операции (Ctrl+Break).',
    params: [],
  },
  {
    nameRu: 'ПолучитьФорму', nameEn: 'GetForm', category: 'Общие', isFunction: true,
    description: 'Получает управляемую форму по полному имени.',
    returnType: 'УправляемаяФорма',
    params: [
      { name: 'ИмяФормы', type: 'Строка', description: 'Полное имя формы (например "Справочник.Номенклатура.ФормаСписка")' },
      { name: 'Владелец', type: 'УправляемаяФорма', description: 'Форма-владелец', optional: true },
      { name: 'КлючУникальности', type: 'Произвольный', description: 'Ключ уникальности', optional: true },
    ],
  },
  {
    nameRu: 'ОткрытьФорму', nameEn: 'OpenForm', category: 'Общие', isFunction: true,
    description: 'Открывает управляемую форму по полному имени.',
    returnType: 'УправляемаяФорма',
    params: [
      { name: 'ИмяФормы', type: 'Строка', description: 'Полное имя формы' },
      { name: 'Параметры', type: 'Структура', description: 'Параметры формы', optional: true },
      { name: 'Владелец', type: 'УправляемаяФорма', description: 'Форма-владелец', optional: true },
      { name: 'КлючУникальности', type: 'Произвольный', description: 'Ключ уникальности', optional: true },
    ],
  },
];

/** Карта для быстрого поиска: нижний регистр имени -> GlobalMethodInfo */
export const GLOBAL_METHODS_MAP: Map<string, GlobalMethodInfo> = new Map();
for (const m of GLOBAL_METHODS) {
  GLOBAL_METHODS_MAP.set(m.nameRu.toLowerCase(), m);
  GLOBAL_METHODS_MAP.set(m.nameEn.toLowerCase(), m);
}
