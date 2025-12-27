/**
 * ASCII decorative layer functionality
 * Creates a decorative layer with ASCII symbols in each row of the grid
 */

import { getRowHeight } from "./utils.js";

// ASCII symbols to use for decoration - curated set
const ASCII_SYMBOLS = [
  "◊", "◈", "◉", "○", "●", "◐", "◑", "◒", "◓",
  "◔", "◕", "◖", "◗", "◘", "◙", "◚", "◛", "◜",
  "◝", "◞", "◟", "◠", "◡", "☀", "☁", "☂", "☃",
  "☄", "★", "☆", "☉", "☊", "☋", "☌", "☍", "☎",
  "☏", "☐", "☑", "☒", "☓", "☔", "☕", "☖", "☗",
  "☘", "☙", "☚", "☛", "☜", "☝", "☞", "☟", "☠",
  "☡", "☢", "☣", "☤", "☥", "☦", "☧", "☨", "☩",
  "☪", "☫", "☬", "☭", "☮", "☯", "☰", "☱", "☲",
  "☳", "☴", "☵", "☶", "☷", "☸", "☹", "☺", "☻",
  "☼", "☽", "☾", "☿", "♀", "♁", "♂", "♃", "♄",
  "♅", "♆", "♇", "♈", "♉", "♊", "♋", "♌", "♍",
  "♎", "♏", "♐", "♑", "♒", "♓", "♔", "♕", "♖",
  "♗", "♘", "♙", "♚", "♛", "♜", "♝", "♞", "♟",
  "♠", "♡", "♢", "♣", "♤", "♥", "♦", "♧", "♨",
  "♩", "♪", "♫", "♬", "♭", "♮", "♯", "♰", "♱",
  "♲", "♳", "♴", "♵", "♶", "♷", "♸", "♹", "♺",
  "♻", "♼", "♽", "♾", "♿", "⚀", "⚁", "⚂", "⚃",
  "⚄", "⚅", "⚆", "⚇", "⚈", "⚉", "⚊", "⚋", "⚌",
  "⚍", "⚎", "⚏", "⚐", "⚑", "⚒", "⚓", "⚔", "⚕",
  "⚖", "⚗", "⚘", "⚙", "⚚", "⚛", "⚜", "⚝", "⚞",
  "⚟", "⚠", "⚡", "⚢", "⚣", "⚤", "⚥", "⚦", "⚧",
  "⚨", "⚩", "⚪", "⚫", "⚬", "⚭", "⚮", "⚯", "⚰",
  "⚱", "⚲", "⚳", "⚴", "⚵", "⚶", "⚷", "⚸", "⚹",
  "⚺", "⚻", "⚼", "⚽", "⚾", "⚿", "⛀", "⛁", "⛂",
  "⛃", "⛄", "⛅", "⛆", "⛇", "⛈", "⛉", "⛊", "⛋",
  "⛌", "⛍", "⛎", "⛏", "⛐", "⛑", "⛒", "⛓", "⛔",
  "⛕", "⛖", "⛗", "⛘", "⛙", "⛚", "⛛", "⛜", "⛝",
  "⛞", "⛟", "⛠", "⛡", "⛢", "⛣", "⛤", "⛥", "⛦",
  "⛧", "⛨", "⛩", "⛪", "⛫", "⛬", "⛭", "⛮", "⛯",
  "⛰", "⛱", "⛲", "⛳", "⛴", "⛵", "⛶", "⛷", "⛸",
  "⛹", "⛺", "⛻", "⛼", "⛽", "⛾", "⛿", "✀", "✁",
  "✂", "✃", "✄", "✅", "✆", "✇", "✈", "✉", "✊",
  "✋", "✌", "✍", "✎", "✏", "✐", "✑", "✒", "✓",
  "✔", "✕", "✖", "✗", "✘", "✙", "✚", "✛", "✜",
  "✝", "✞", "✟", "✠", "✡", "✢", "✣", "✤", "✥",
  "✦", "✧", "✨", "✩", "✪", "✫", "✬", "✭", "✮",
  "✯", "✰", "✱", "✲", "✳", "✴", "✵", "✶", "✷",
  "✸", "✹", "✺", "✻", "✼", "✽", "✾", "✿", "❀",
  "❁", "❂", "❃", "❄", "❅", "❆", "❇", "❈", "❉",
  "❊", "❋", "❌", "❍", "❎", "❏", "❐", "❑", "❒",
  "❓", "❔", "❕", "❖", "❗", "❘", "❙", "❚", "❛",
  "❜", "❝", "❞", "❟", "❠", "❡", "❢", "❣", "❤",
  "❥", "❦", "❧", "❨", "❩", "❪", "❫", "❬", "❭",
  "❮", "❯", "❰", "❱", "❲", "❳", "❴", "❵", "❶",
  "❷", "❸", "❹", "❺", "❻", "❼", "❽", "❾", "❿",
  "➀", "➁", "➂", "➃", "➄", "➅", "➆", "➇", "➈",
  "➉", "➊", "➋", "➌", "➍", "➎", "➏", "➐", "➑",
  "➒", "➓", "➔", "➕", "➖", "➗", "➘", "➙", "➚",
  "➛", "➜", "➝", "➞", "➟", "➠", "➡", "➢", "➣",
  "➤", "➥", "➦", "➧", "➨", "➩", "➪", "➫", "➬",
  "➭", "➮", "➯", "➰", "➱", "➲", "➳", "➴", "➵",
  "➶", "➷", "➸", "➹", "➺", "➻", "➼", "➽", "➾",
  "➿", "⟀", "⟁", "⟂", "⟃", "⟄", "⟅", "⟆", "⟇",
  "⟈", "⟉", "⟊", "⟋", "⟌", "⟍", "⟎", "⟏", "⟐",
  "⟑", "⟒", "⟓", "⟔", "⟕", "⟖", "⟗", "⟘", "⟙",
  "⟚", "⟛", "⟜", "⟝", "⟞", "⟟", "⟠", "⟡", "⟢",
  "⟣", "⟤", "⟥", "⟦", "⟧", "⟨", "⟩", "⟪", "⟫",
  "⟬", "⟭", "⟮", "⟯", "⟰", "⟱", "⟲", "⟳", "⟴",
  "⟵", "⟶", "⟷", "⟸", "⟹", "⟺", "⟻", "⟼", "⟽",
  "⟾", "⟿", "⤀", "⤁", "⤂", "⤃", "⤄", "⤅", "⤆",
  "⤇", "⤈", "⤉", "⤊", "⤋", "⤌", "⤍", "⤎", "⤏",
  "⤐", "⤑", "⤒", "⤓", "⤔", "⤕", "⤖", "⤗", "⤘",
  "⤙", "⤚", "⤛", "⤜", "⤝", "⤞", "⤟", "⤠", "⤡",
  "⤢", "⤣", "⤤", "⤥", "⤦", "⤧", "⤨", "⤩", "⤪",
  "⤫", "⤬", "⤭", "⤮", "⤯", "⤰", "⤱", "⤲", "⤳",
  "⤴", "⤵", "⤶", "⤷", "⤸", "⤹", "⤺", "⤻", "⤼",
  "⤽", "⤾", "⤿", "⥀", "⥁", "⥂", "⥃", "⥄", "⥅",
  "⥆", "⥇", "⥈", "⥉", "⥊", "⥋", "⥌", "⥍", "⥎",
  "⥏", "⥐", "⥑", "⥒", "⥓", "⥔", "⥕", "⥖", "⥗",
  "⥘", "⥙", "⥚", "⥛", "⥜", "⥝", "⥞", "⥟", "⥠",
  "⥡", "⥢", "⥣", "⥤", "⥥", "⥦", "⥧", "⥨", "⥩",
  "⥪", "⥫", "⥬", "⥭", "⥮", "⥯", "⥰", "⥱", "⥲",
  "⥳", "⥴", "⥵", "⥶", "⥷", "⥸", "⥹", "⥺", "⥻",
  "⥼", "⥽", "⥾", "⥿", "⦀", "⦁", "⦂", "⦃", "⦄",
  "⦅", "⦆", "⦇", "⦈", "⦉", "⦊", "⦋", "⦌", "⦍",
  "⦎", "⦏", "⦐", "⦑", "⦒", "⦓", "⦔", "⦕", "⦖",
  "⦗", "⦘", "⦙", "⦚", "⦛", "⦜", "⦝", "⦞", "⦟",
  "⦠", "⦡", "⦢", "⦣", "⦤", "⦥", "⦦", "⦧", "⦨",
  "⦩", "⦪", "⦫", "⦬", "⦭", "⦮", "⦯", "⦰", "⦱",
  "⦲", "⦳", "⦴", "⦵", "⦶", "⦷", "⦸", "⦹", "⦺",
  "⦻", "⦼", "⦽", "⦾", "⦿", "⧀", "⧁", "⧂", "⧃",
  "⧄", "⧅", "⧆", "⧇", "⧈", "⧉", "⧊", "⧋", "⧌",
  "⧍", "⧎", "⧏", "⧐", "⧑", "⧒", "⧓", "⧔", "⧕",
  "⧖", "⧗", "⧘", "⧙", "⧚", "⧛", "⧜", "⧝", "⧞",
  "⧟", "⧠", "⧡", "⧢", "⧣", "⧤", "⧥", "⧦", "⧧",
  "⧨", "⧩", "⧪", "⧫", "⧬", "⧭", "⧮", "⧯", "⧰",
  "⧱", "⧲", "⧳", "⧴", "⧵", "⧶", "⧷", "⧸", "⧹",
  "⧺", "⧻", "⧼", "⧽", "⧾", "⧿", "⨀", "⨁", "⨂",
  "⨃", "⨄", "⨅", "⨆", "⨇", "⨈", "⨉", "⨊", "⨋",
  "⨌", "⨍", "⨎", "⨏", "⨐", "⨑", "⨒", "⨓", "⨔",
  "⨕", "⨖", "⨗", "⨘", "⨙", "⨚", "⨛", "⨜", "⨝",
  "⨞", "⨟", "⨠", "⨡", "⨢", "⨣", "⨤", "⨥", "⨦",
  "⨧", "⨨", "⨩", "⨪", "⨫", "⨬", "⨭", "⨮", "⨯",
  "⨰", "⨱", "⨲", "⨳", "⨴", "⨵", "⨶", "⨷", "⨸",
  "⨹", "⨺", "⨻", "⨼", "⨽", "⨾", "⨿", "⩀", "⩁",
  "⩂", "⩃", "⩄", "⩅", "⩆", "⩇", "⩈", "⩉", "⩊",
  "⩋", "⩌", "⩍", "⩎", "⩏", "⩐", "⩑", "⩒", "⩓",
  "⩔", "⩕", "⩖", "⩗", "⩘", "⩙", "⩚", "⩛", "⩜",
  "⩝", "⩞", "⩟", "⩠", "⩡", "⩢", "⩣", "⩤", "⩥",
  "⩦", "⩧", "⩨", "⩩", "⩪", "⩫", "⩬", "⩭", "⩮",
  "⩯", "⩰", "⩱", "⩲", "⩳", "⩴", "⩵", "⩶", "⩷",
  "⩸", "⩹", "⩺", "⩻", "⩼", "⩽", "⩾", "⩿", "⪀",
  "⪁", "⪂", "⪃", "⪄", "⪅", "⪆", "⪇", "⪈", "⪉",
  "⪊", "⪋", "⪌", "⪍", "⪎", "⪏", "⪐", "⪑", "⪒",
  "⪓", "⪔", "⪕", "⪖", "⪗", "⪘", "⪙", "⪚", "⪛",
  "⪜", "⪝", "⪞", "⪟", "⪠", "⪡", "⪢", "⪣", "⪤",
  "⪥", "⪦", "⪧", "⪨", "⪩", "⪪", "⪫", "⪬", "⪭",
  "⪮", "⪯", "⪰", "⪱", "⪲", "⪳", "⪴", "⪵", "⪶",
  "⪷", "⪸", "⪹", "⪺", "⪻", "⪼", "⪽", "⪾", "⪿",
  "⫀", "⫁", "⫂", "⫃", "⫄", "⫅", "⫆", "⫇", "⫈",
  "⫉", "⫊", "⫋", "⫌", "⫍", "⫎", "⫏", "⫐", "⫑",
  "⫒", "⫓", "⫔", "⫕", "⫖", "⫗", "⫘", "⫙", "⫚",
  "⫛", "⫝̸", "⫝", "⫞", "⫟", "⫠", "⫡", "⫢", "⫣",
  "⫤", "⫥", "⫦", "⫧", "⫨", "⫩", "⫪", "⫫", "⫬",
  "⫭", "⫮", "⫯", "⫰", "⫱", "⫲", "⫳", "⫴", "⫵",
  "⫶", "⫷", "⫸", "⫹", "⫺", "⫻", "⫼", "⫽", "⫾",
  "⫿", "⬀", "⬁", "⬂", "⬃", "⬄", "⬅", "⬆", "⬇",
  "⬈", "⬉", "⬊", "⬋", "⬌", "⬍", "⬎", "⬏", "⬐",
  "⬑", "⬒", "⬓", "⬔", "⬕", "⬖", "⬗", "⬘", "⬙",
  "⬚", "⬛", "⬜", "⬝", "⬞", "⬟", "⬠", "⬡", "⬢",
  "⬣", "⬤", "⬥", "⬦", "⬧", "⬨", "⬩", "⬪", "⬫",
  "⬬", "⬭", "⬮", "⬯", "⬰", "⬱", "⬲", "⬳", "⬴",
  "⬵", "⬶", "⬷", "⬸", "⬹", "⬺", "⬻", "⬼", "⬽",
  "⬾", "⬿", "⭀", "⭁", "⭂", "⭃", "⭄", "⭅", "⭆",
  "⭇", "⭈", "⭉", "⭊", "⭋", "⭌", "⭍", "⭎", "⭏",
  "⭐", "⭑", "⭒", "⭓", "⭔", "⭕", "⭖", "⭗", "⭘",
  "⭙", "⭚", "⭛", "⭜", "⭝", "⭞", "⭟", "⭠", "⭡",
  "⭢", "⭣", "⭤", "⭥", "⭦", "⭧", "⭨", "⭩", "⭪",
  "⭫", "⭬", "⭭", "⭮", "⭯", "⭰", "⭱", "⭲", "⭳",
  "⭴", "⭵", "⭶", "⭷", "⭸", "⭹", "⭺", "⭻", "⭼",
  "⭽", "⭾", "⭿", "⮀", "⮁", "⮂", "⮃", "⮄", "⮅",
  "⮆", "⮇", "⮈", "⮉", "⮊", "⮋", "⮌", "⮍", "⮎",
  "⮏", "⮐", "⮑", "⮒", "⮓", "⮔", "⮕", "⮖", "⮗",
  "⮘", "⮙", "⮚", "⮛", "⮜", "⮝", "⮞", "⮟", "⮠",
  "⮡", "⮢", "⮣", "⮤", "⮥", "⮦", "⮧", "⮨", "⮩",
  "⮪", "⮫", "⮬", "⮭", "⮮", "⮯", "⮰", "⮱", "⮲",
  "⮳", "⮴", "⮵", "⮶", "⮷", "⮸", "⮹", "⮺", "⮻",
  "⮼", "⮽", "⮾", "⮿", "⯀", "⯁", "⯂", "⯃", "⯄",
  "⯅", "⯆", "⯇", "⯈", "⯉", "⯊", "⯋", "⯌", "⯍",
  "⯎", "⯏", "⯐", "⯑", "⯒", "⯓", "⯔", "⯕", "⯖",
  "⯗", "⯘", "⯙", "⯚", "⯛", "⯜", "⯝", "⯞", "⯟",
  "⯠", "⯡", "⯢", "⯣", "⯤", "⯥", "⯦", "⯧", "⯨",
  "⯩", "⯪", "⯫", "⯬", "⯭", "⯮", "⯯", "⯰", "⯱",
  "⯲", "⯳", "⯴", "⯵", "⯶", "⯷", "⯸", "⯹", "⯺",
  "⯻", "⯼", "⯽", "⯾", "⯿"
];

let asciiLayer = null;

/**
 * Get a random ASCII symbol
 */
function getRandomSymbol() {
  return ASCII_SYMBOLS[Math.floor(Math.random() * ASCII_SYMBOLS.length)];
}

/**
 * Create ASCII decorative elements in a spiral pattern
 */
function createASCIIElements() {
  if (!asciiLayer) return;

  // Clear existing elements
  asciiLayer.innerHTML = "";

  // Calculate full document height
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  const rowHeight = getRowHeight();
  const totalRows = Math.ceil(documentHeight / rowHeight);
  const gridColumns = 16; // Match the grid column count

  // Create one ASCII symbol per row, positioned in a spiral pattern
  // Spiral: left-to-right, then right-to-left, alternating
  for (let row = 0; row < totalRows; row++) {
    const symbolElement = document.createElement("div");
    symbolElement.className = "ascii-symbol";
    
    // Spiral pattern: alternate direction each row
    const isEvenRow = row % 2 === 0;
    let col;
    
    if (isEvenRow) {
      // Even rows: left to right (1, 2, 3, ..., 15, 1, 2, ...)
      col = (row % gridColumns) + 1;
    } else {
      // Odd rows: right to left (15, 14, 13, ..., 1, 15, 14, ...)
      // Calculate position going backwards
      const positionInCycle = row % gridColumns;
      col = gridColumns - positionInCycle;
    }
    
    symbolElement.style.gridColumn = col;
    symbolElement.style.gridRow = row + 1;
    
    // Set random ASCII symbol
    symbolElement.textContent = getRandomSymbol();
    
    asciiLayer.appendChild(symbolElement);
  }

  // Set container height to match the number of rows (make it scrollable)
  asciiLayer.style.height = `${totalRows * rowHeight}px`;
  asciiLayer.style.minHeight = `${totalRows * rowHeight}px`;
}

/**
 * Initialize ASCII decorative layer
 */
export function initASCIIDecorative() {
  // Remove existing layer if any
  const existingLayer = document.getElementById("ascii-decorative-layer");
  if (existingLayer) {
    existingLayer.remove();
  }

  // Create layer
  asciiLayer = document.createElement("div");
  asciiLayer.id = "ascii-decorative-layer";
  document.body.appendChild(asciiLayer);

  createASCIIElements();

  // Update on resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      createASCIIElements();
    }, 150);
  });

  // Update when document height changes
  let lastDocumentHeight = 0;
  const observer = new MutationObserver(() => {
    if (window.asciiUpdateTimeout) {
      clearTimeout(window.asciiUpdateTimeout);
    }
    window.asciiUpdateTimeout = setTimeout(() => {
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );

      if (Math.abs(documentHeight - lastDocumentHeight) > getRowHeight()) {
        lastDocumentHeight = documentHeight;
        createASCIIElements();
      }
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initialize last height
  lastDocumentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
}

