// messages.js
// Message library for Chauhan Insurance Advisory reminder system.
//
// RULES FOR ALL MESSAGES:
// 1. Plain English. A 5-year-old should understand the words.
// 2. Short sentences. Most under 12 words.
// 3. No em-dashes (—). No bullet dots (•). No AI-style punctuation.
// 4. Use commas, periods, and line breaks for rhythm.
// 5. Hinglish is fine. Mix English and Hindi like a real person texting.
// 6. Every message ends with the Chauhan signature block.
//
// Available placeholders in messages:
//   {{first_name}}    client's first name
//   {{premium}}       premium amount (e.g. "24,500")
//   {{due_date}}      due date as readable string
//   {{policy_name}}   product name
//   {{policy_number}} policy number
//   {{company}}       LIC or Star Health
//   {{years}}         number of years (for anniversaries)

const SIGNATURE = `\n\nChauhan Insurance Advisory
Ramjanam Chauhan, Advisor
Rohan Chauhan, son, helping with reminders
Reply here for any help.`;

const MESSAGES = {

  // PREMIUM REMINDERS

  premium_t30: {
    label: "Premium due in 30 days",
    body: `Namaste {{first_name}} ji,

Aapki {{company}} policy ka premium 30 din baad due hai.
Date: {{due_date}}
Amount: Rs. {{premium}}

Yeh early reminder isliye hai taaki aap aaram se plan kar sakein. Koi jaldi nahi hai.

Ek chhoti tip: agar har mahine premium ka 1/12 hissa side mein rakh do, toh due date pe paisa already ready hota hai. Sochne layak baat hai.

Payment kaise karna hai, sab steps PDF mein hain.`,
  },

  premium_t7: {
    label: "Premium due in 7 days",
    body: `{{first_name}} ji, namaste.

Aapki {{company}} policy ka premium 7 din baad due hai.
Date: {{due_date}}
Amount: Rs. {{premium}}

Jaldi pay kar sakein toh achha hai. Late hone se policy ke benefits ruk sakte hain.

Payment ke saare options PDF mein simple steps mein diye hain. Online ho jayega 5 minute mein.`,
  },

  premium_t0: {
    label: "Premium due today",
    body: `{{first_name}} ji, namaste.

Aaj aapki {{company}} policy ka premium due hai.
Amount: Rs. {{premium}}

Aaj hi pay kar dijiye, baad ke liye mat chhodiye. Insurance ka cover continuous rehna zaroori hai.

Payment ke steps PDF mein hain, ya online sirf 5 minute lagega.`,
  },

  premium_overdue: {
    label: "Premium overdue (one gentle nudge, T+3)",
    body: `{{first_name}} ji, namaste.

Aapki {{company}} policy ka premium 3 din pehle due tha. Abhi tak hua nahi hai.

Yeh reminder isliye taaki aap bhul na jayein. Pay kar dijiye aaj, simple hai.

Agar koi problem ho rahi hai payment mein, toh mujhe (Rohan) message kar dijiye. Main help kar dunga.`,
  },

  // RELATIONSHIP MESSAGES

  birthday: {
    label: "Birthday wish",
    body: `{{first_name}} ji, Janamdin ki bahut bahut shubhkamnaye!

Aap aur aapka pariwar hamesha khush rahein, swasth rahein. Aaj aap special ho.

Aaj koi insurance baat nahi. Bas yeh kehne ke liye message kiya.`,
  },

  anniversary_wedding: {
    label: "Wedding anniversary",
    body: `{{first_name}} ji aur pariwar ko shaadi ki saalgirah ki bahut bahut mubarak.

Aap dono ka saath aise hi banaa rahe. Bahut khushiyaan aapke ghar mein.`,
  },

  policy_anniversary: {
    label: "Policy completion years",
    body: `{{first_name}} ji, namaste.

Aapki {{company}} policy ko aaj {{years}} saal pure ho gaye.

Itne saal continuously coverage rakhna achhi baat hai. Yeh consistency hi sahi financial planning hai.

Bas yeh acknowledge karna tha. Aapka din achha rahe.`,
  },

  // FESTIVAL MESSAGES

  diwali: {
    label: "Diwali",
    body: `{{first_name}} ji aur poore pariwar ko Diwali ki dher saari shubhkamnaye.

Yeh tyohaar aapke ghar mein roshni, khushi aur sehat laaye. Apno ke saath bita hua waqt sabse keemti hai.`,
  },

  holi: {
    label: "Holi",
    body: `{{first_name}} ji, Holi ki bahut bahut shubhkamnaye!

Aapke jeevan mein har rang ki khushi ho. Pariwar ke saath aaj ka din mast bitayein.`,
  },

  new_year: {
    label: "New Year",
    body: `{{first_name}} ji, Naye Saal ki bahut bahut shubhkamnaye.

Yeh saal aapke aur pariwar ke liye sehat aur khushiyon se bhara ho.`,
  },

  raksha_bandhan: {
    label: "Raksha Bandhan",
    body: `{{first_name}} ji, Raksha Bandhan ki shubhkamnaye.

Bhai behen ka rishta hamesha mazboot rahe. Pariwar ke saath aaj ka din enjoy kariye.`,
  },

  eid: {
    label: "Eid",
    body: `{{first_name}} ji, Eid Mubarak.

Yeh din aapke ghar mein khushiyaan, sehat, aur barkat laaye. Pariwar ke saath waqt enjoy kariye.`,
  },

  // LEAD INTRO

  lead_intro: {
    label: "Introductory message to a new lead",
    body: `Namaste {{first_name}} ji,

Mera naam Rohan Chauhan hai. Mere papa Ramjanam Chauhan insurance advisor hain (LIC aur Star Health).

Aapne humse insurance ke baare mein puchha tha. Hum aapko pressure nahi denge. Jab aapko zaroorat ho, message kar dijiye, hum sahi advice denge.

Tab tak ke liye aapka din achha rahe.`,
  },
};

// Helper: fill placeholders in a message body
function fillMessage(messageKey, data) {
  const tmpl = MESSAGES[messageKey];
  if (!tmpl) throw new Error(`Unknown message key: ${messageKey}`);

  let body = tmpl.body;
  for (const [k, v] of Object.entries(data)) {
    body = body.replaceAll(`{{${k}}}`, v);
  }
  return body + SIGNATURE;
}

// Helper: pick the right premium message based on days to due
function pickPremiumMessageKey(daysToDue) {
  if (daysToDue < 0) return "premium_overdue";
  if (daysToDue === 0) return "premium_t0";
  if (daysToDue <= 7)  return "premium_t7";
  return "premium_t30";
}

// Helper: build a wa.me link with pre-filled message
function buildWhatsAppLink(phone, messageBody) {
  const cleaned = String(phone).replace(/\D/g, '');
  const withCountry = cleaned.length === 10 ? '91' + cleaned : cleaned;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(messageBody)}`;
}

// Export for browser or node use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MESSAGES, SIGNATURE, fillMessage, pickPremiumMessageKey, buildWhatsAppLink };
}
