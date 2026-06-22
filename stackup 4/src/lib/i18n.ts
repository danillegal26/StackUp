// StackUp i18n — простой словарь без внешних зависимостей.
// Два языка: 'ru' (русский, по умолчанию) и 'en' (английский).
// Хук useT() возвращает нужный набор переводов; переключатель в шапке
// сохраняет выбор в localStorage ('stackup_lang').
//
// Добавить новый язык: скопировать объект ru, поменять строки, добавить
// ключ в тип Lang и в словарь translations.

export type Lang = 'ru' | 'en';

export const LANG_STORAGE_KEY = 'stackup_lang';

export function detectLang(): Lang {
  if (typeof localStorage === 'undefined') return 'ru';
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'en' || stored === 'ru') return stored;
  return 'ru';
}

// ---------------------------------------------------------------------------
// Словарь переводов
// ---------------------------------------------------------------------------
const ru = {
  // --- Home ---
  homeTagline: 'Считайте стеки за домашним покерным столом. Без карт и без онлайн-игры на деньги — только удобный учёт фишек для вашей компании.',
  homeCreateBtn: 'Создать стол',

  // --- CreateRoom ---
  newTable: 'Новый стол',
  tableName: 'Название игры (необязательно)',
  tableNamePlaceholder: 'Пятничный покер',
  startStack: 'Стартовый стек',
  playerCount: 'Количество игроков',
  smallBlind: 'Малый блайнд',
  bigBlind: 'Большой блайнд',
  buyIn: 'Бай-ин (необязательно)',
  currency: 'Валюта',
  turnTimer: 'Таймер хода',
  timerSec: (n: number) => `${n} секунд`,
  timerSecDefault: (n: number) => `${n} секунд (по умолчанию)`,
  timerOff: 'Отключить',
  createBtn: 'Создать и получить QR-код',
  creating: 'Создаём…',
  errStartStack: 'Стартовый стек должен быть больше нуля',
  errPlayerCount: 'Количество игроков — от 2 до 50',
  errBlinds: 'Большой блайнд должен быть больше малого, оба — больше нуля',
  errCreateRoom: 'Не удалось создать стол',

  // --- JoinRoom ---
  joinTitle: 'Присоединиться',
  joinStartStack: (n: string) => `Стартовый стек: ${n} фишек`,
  yourName: 'Ваше имя',
  namePlaceholder: 'Например, Алекс',
  next: 'Далее',
  chooseAvatar: 'Выберите аватар',
  avatarHint: 'Он будет виден всем за столом',
  back: 'Назад',
  joinBtn: 'Сесть за стол',
  joining: 'Подключаемся…',
  errJoinNameRequired: 'Введите имя',
  errJoinRoom: 'Не удалось подключиться к столу',
  errRoomNotFound: 'Стол не найден. Проверьте ссылку или QR-код.',
  errRoomNotFoundShort: 'Стол не найден',

  // --- HostDashboard ---
  hostPanel: 'Панель организатора',
  inTable: (n: string | number) => `в столе: ${n}`,
  blindsLabel: 'блайнды',
  blindsPill: (sb: string, bb: string) => `блайнды ${sb}/${bb}`,
  copyLink: 'Скопировать ссылку',
  copied: 'Скопировано',
  wantToPlay: 'Хотите играть сами?',
  yourNameTable: 'Ваше имя за столом',
  sitDown: 'Сесть за стол',
  players: 'Игроки',
  noPlayersYet: 'Пока никто не подключился. Покажите QR-код игрокам.',
  you: 'вы',
  host: 'организатор',
  startGame: 'Начать игру',
  needMinPlayers: 'Нужно минимум 2 игрока за столом',
  blindsBtn: 'Блайнды',
  timerBtn: (s: number | null) => s != null ? `Таймер: ${s}с` : 'Таймер: выкл',
  nextHand: 'Следующая раздача →',
  resolveFirst: (pot: string) => `Сначала завершите раздачу и распределите банк ${pot}`,
  nextStreet: 'Следующая улица →',
  awardPot: 'Определить победителя',
  handHistory: (n: number) => `История раздач (${n})`,
  txHistory: (n: number) => `История операций (${n})`,
  finishGame: 'Завершить игру',
  finishGameHint: (pot: string) => `Текущая раздача ещё не завершена — банк ${pot} вернётся игрокам, если завершить игру сейчас`,
  finishConfirm: 'Завершить игру? Игроки увидят итоговый результат, изменения станут недоступны.',
  errKickPlayer: 'Не удалось убрать игрока',
  errFinishGame: 'Не удалось завершить игру',
  errSitDown: 'Не удалось сесть за стол',
  errStartGame: 'Не удалось начать игру',
  errNextHand: 'Не удалось перейти к следующей раздаче',
  errNextStreet: 'Не удалось перейти на следующую улицу',
  errNameRequired: 'Введите имя',
  rebuy: 'Rebuy',
  stackBtn: 'Стек',
  handN: (n: number) => `Раздача №${n}`,

  // --- Timer modal ---
  timerModalTitle: 'Таймер хода',
  timerModalHint: 'Сколько секунд у игрока на ход',
  timerDisable: 'Отключить таймер',
  timerClose: 'Закрыть',

  // --- PlayerView ---
  leaveTable: 'Покинуть стол',
  leaveConfirm: 'Покинуть стол? Текущий стек зафиксируется как ваш итоговый результат.',
  errLeave: 'Не удалось покинуть стол',
  waitingForHost: 'Ожидаем, когда организатор начнёт игру…',
  zeroStackBanner: 'Ваш стек закончился — вы пропускаете раздачу. Скажите организатору, чтобы сделал ребай, если хотите продолжить.',
  awaitingWinner: (pot: string) => `Вскрытие, банк ${pot} — организатор сейчас выберет победителя.`,
  roundOver: 'Круг торгов завершён — организатор сдаёт следующую карту(ы).',
  gameFinished: 'Игра завершена. Переходим к итогам…',
  leftTable: 'Вы вышли из-за стола (или организатор это сделал за вас). Ваш итоговый результат зафиксирован — он появится, когда игра завершится.',
  yourStack: 'Ваш стек',
  errRoomNotFoundPlayer: 'Стол не найден',

  // --- ActionBar ---
  fold: 'Пас',
  check: 'Чек',
  call: (amount: string) => `Колл ${amount}`,
  raise: (amount: string) => `Рейз ${amount}`,
  bet: (amount: string) => `Ставка ${amount}`,
  allIn: 'Олл-ин',
  raiseAmount: 'Сумма рейза',
  betAmount: 'Сумма ставки',
  decrease: 'Уменьшить',
  increase: 'Увеличить',
  errAction: 'Не удалось выполнить действие',

  // --- PokerTable ---
  actionFold: 'Сброс',
  actionCheck: 'Чек',
  actionCall: 'Колл',
  actionBet: 'Ставка',
  actionRaise: 'Рейз',
  actionAllIn: 'Олл-ин',
  dealerLabel: 'Дилер',
  bankLabel: 'Банк',
  noPlayers: 'За столом пока никого нет',

  // --- StageIndicator ---
  preflop: 'Префлоп',
  flop: 'Флоп',
  turn: 'Тёрн',
  river: 'Ривер',
  showdown: 'Вскрытие',
  stageAriaLabel: (s: string) => `Стадия раздачи: ${s}`,

  // --- NextToActBanner ---
  acting: 'Ходит',
  actingYou: 'вы',
  secondsSuffix: 'с',

  // --- WinBanner ---
  winsBank: 'забирает банк',
  winsBankAnd: ' и ',

  // --- WinnerSelectModal ---
  selectWinner: 'Выберите победителя',
  mainPot: 'Основной банк',
  sidePot: 'Банк',
  confirmHand: 'Подтвердить и завершить раздачу',
  distributing: 'Распределяем…',
  errSelectWinner: 'Выберите хотя бы одного победителя для каждого банка',
  errAwardPot: 'Не удалось распределить банк',

  // --- BlindsModal ---
  blindsModalTitle: 'Блайнды',
  save: 'Сохранить',
  saving: 'Сохраняем…',
  errBlindsModal: 'Большой блайнд должен быть больше малого, оба — больше нуля',
  errSetBlinds: 'Не удалось изменить блайнды',

  // --- RebuyModal ---
  rebuyTitle: 'Докупка',
  rebuyAmount: 'Сумма докупки',
  rebuyPlaceholder: 'Например, 250',
  confirm: 'Зафиксировать',
  confirming: 'Добавляем…',
  errRebuyZero: 'Введите сумму больше нуля',
  errRebuy: 'Не удалось зафиксировать докупку',

  // --- StackAdjustModal ---
  stackAdjustTitle: 'Корректировка стека',
  stackNewValue: 'Новое значение стека',
  stackPlaceholder: 'Например, 250',
  errStackNegative: 'Стек не может стать отрицательным',
  errStackAdjust: 'Не удалось обновить стек',

  // --- Results / Settlement ---
  resultsTitle: 'Итоги',
  winner: 'Победитель',
  player: 'Игрок',
  net: 'Результат',
  settlement: 'Взаиморасчёт',
  pays: 'платит',
  noSettlement: 'Все в ноль — расчётов нет.',
  backToLobby: 'Создать новый стол',

  // --- TransactionLog ---
  txBuyin: 'Вход',
  txRebuy: 'Докупка',
  txAdjust: 'Корректировка',
  txPlayer: 'Игрок',

  // --- HandHistoryList ---
  handHistoryPlayer: 'Игрок',
  pot: 'банк',

  // --- QRCodeBlock ---
  copyLink2: 'Скопировать ссылку',
  copied2: 'Скопировано',

  // --- Modal ---
  close: 'Закрыть',

  // --- ui.tsx ---
  loading: 'Загрузка',

  // --- Lang toggle ---
  langLabel: 'EN',
};

const en: typeof ru = {
  homeTagline: 'Track chip stacks at your home poker table. No dealing, no real-money play — just a convenient chip counter for your crew.',
  homeCreateBtn: 'Create table',

  newTable: 'New table',
  tableName: 'Game name (optional)',
  tableNamePlaceholder: 'Friday poker',
  startStack: 'Starting stack',
  playerCount: 'Number of players',
  smallBlind: 'Small blind',
  bigBlind: 'Big blind',
  buyIn: 'Buy-in (optional)',
  currency: 'Currency',
  turnTimer: 'Turn timer',
  timerSec: (n: number) => `${n} seconds`,
  timerSecDefault: (n: number) => `${n} seconds (default)`,
  timerOff: 'Disabled',
  createBtn: 'Create & get QR code',
  creating: 'Creating…',
  errStartStack: 'Starting stack must be greater than zero',
  errPlayerCount: 'Player count must be between 2 and 50',
  errBlinds: 'Big blind must be greater than small blind, both greater than zero',
  errCreateRoom: 'Failed to create table',

  joinTitle: 'Join table',
  joinStartStack: (n: string) => `Starting stack: ${n} chips`,
  yourName: 'Your name',
  namePlaceholder: 'e.g. Alex',
  next: 'Next',
  chooseAvatar: 'Choose avatar',
  avatarHint: 'Everyone at the table will see it',
  back: 'Back',
  joinBtn: 'Take a seat',
  joining: 'Joining…',
  errJoinNameRequired: 'Enter your name',
  errJoinRoom: 'Failed to join table',
  errRoomNotFound: 'Table not found. Check the link or QR code.',
  errRoomNotFoundShort: 'Table not found',

  hostPanel: 'Host panel',
  inTable: (n: string | number) => `in table: ${n}`,
  blindsLabel: 'blinds',
  blindsPill: (sb: string, bb: string) => `blinds ${sb}/${bb}`,
  copyLink: 'Copy link',
  copied: 'Copied',
  wantToPlay: 'Want to play too?',
  yourNameTable: 'Your name at the table',
  sitDown: 'Take a seat',
  players: 'Players',
  noPlayersYet: 'No one connected yet. Show the QR code to players.',
  you: 'you',
  host: 'host',
  startGame: 'Start game',
  needMinPlayers: 'Need at least 2 players at the table',
  blindsBtn: 'Blinds',
  timerBtn: (s: number | null) => s != null ? `Timer: ${s}s` : 'Timer: off',
  nextHand: 'Next hand →',
  resolveFirst: (pot: string) => `Finish the hand and award the ${pot} pot first`,
  nextStreet: 'Next street →',
  awardPot: 'Pick winner',
  handHistory: (n: number) => `Hand history (${n})`,
  txHistory: (n: number) => `Transaction log (${n})`,
  finishGame: 'Finish game',
  finishGameHint: (pot: string) => `Current hand not finished — the ${pot} pot will be returned to players if you finish now`,
  finishConfirm: 'Finish the game? Players will see final results and no further changes will be possible.',
  errKickPlayer: 'Failed to remove player',
  errFinishGame: 'Failed to finish game',
  errSitDown: 'Failed to take seat',
  errStartGame: 'Failed to start game',
  errNextHand: 'Failed to go to next hand',
  errNextStreet: 'Failed to advance street',
  errNameRequired: 'Enter your name',
  rebuy: 'Rebuy',
  stackBtn: 'Stack',
  handN: (n: number) => `Hand #${n}`,

  timerModalTitle: 'Turn timer',
  timerModalHint: 'How many seconds each player has to act',
  timerDisable: 'Disable timer',
  timerClose: 'Close',

  leaveTable: 'Leave table',
  leaveConfirm: 'Leave the table? Your current stack will be recorded as your final result.',
  errLeave: 'Failed to leave table',
  waitingForHost: 'Waiting for the host to start the game…',
  zeroStackBanner: 'Your stack is empty — you are sitting out this hand. Ask the host for a rebuy to continue.',
  awaitingWinner: (pot: string) => `Showdown — the host is picking the winner for the ${pot} pot.`,
  roundOver: 'Betting round over — the host is dealing the next card(s).',
  gameFinished: 'Game over. Redirecting to results…',
  leftTable: 'You left the table (or the host removed you). Your final result is recorded and will appear when the game ends.',
  yourStack: 'Your stack',
  errRoomNotFoundPlayer: 'Table not found',

  fold: 'Fold',
  check: 'Check',
  call: (amount: string) => `Call ${amount}`,
  raise: (amount: string) => `Raise ${amount}`,
  bet: (amount: string) => `Bet ${amount}`,
  allIn: 'All-in',
  raiseAmount: 'Raise amount',
  betAmount: 'Bet amount',
  decrease: 'Decrease',
  increase: 'Increase',
  errAction: 'Failed to perform action',

  actionFold: 'Fold',
  actionCheck: 'Check',
  actionCall: 'Call',
  actionBet: 'Bet',
  actionRaise: 'Raise',
  actionAllIn: 'All-in',
  dealerLabel: 'Dealer',
  bankLabel: 'Pot',
  noPlayers: 'No players at the table yet',

  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  stageAriaLabel: (s: string) => `Hand stage: ${s}`,

  acting: 'Acting',
  actingYou: 'you',
  secondsSuffix: 's',

  winsBank: 'wins the pot',
  winsBankAnd: ' & ',

  selectWinner: 'Pick winner',
  mainPot: 'Main pot',
  sidePot: 'Side pot',
  confirmHand: 'Confirm & end hand',
  distributing: 'Awarding…',
  errSelectWinner: 'Select at least one winner for each pot',
  errAwardPot: 'Failed to award pot',

  blindsModalTitle: 'Blinds',
  save: 'Save',
  saving: 'Saving…',
  errBlindsModal: 'Big blind must be greater than small blind, both greater than zero',
  errSetBlinds: 'Failed to update blinds',

  rebuyTitle: 'Rebuy',
  rebuyAmount: 'Rebuy amount',
  rebuyPlaceholder: 'e.g. 250',
  confirm: 'Confirm',
  confirming: 'Adding…',
  errRebuyZero: 'Enter an amount greater than zero',
  errRebuy: 'Failed to record rebuy',

  stackAdjustTitle: 'Stack adjustment',
  stackNewValue: 'New stack value',
  stackPlaceholder: 'e.g. 250',
  errStackNegative: 'Stack cannot go negative',
  errStackAdjust: 'Failed to update stack',

  resultsTitle: 'Results',
  winner: 'Winner',
  player: 'Player',
  net: 'Net',
  settlement: 'Settlements',
  pays: 'pays',
  noSettlement: 'Everyone is even — no settlements needed.',
  backToLobby: 'Create new table',

  txBuyin: 'Buy-in',
  txRebuy: 'Rebuy',
  txAdjust: 'Adjustment',
  txPlayer: 'Player',

  handHistoryPlayer: 'Player',
  pot: 'pot',

  copyLink2: 'Copy link',
  copied2: 'Copied',

  close: 'Close',

  loading: 'Loading',

  langLabel: 'RU',
};

export type Translations = typeof ru;
export const translations: Record<Lang, Translations> = { ru, en };
