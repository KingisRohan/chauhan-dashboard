// helplines.js
// Verified helpline numbers for LIC and Star Health.
// Update if the companies change their numbers.

const HELPLINES = {
  LIC: {
    company_name: "LIC of India",
    customer_care: "022-6827 6827",
    customer_care_label: "24x7 Customer Care",
    whatsapp: "+91 89768 62090",
    whatsapp_label: "Send 'Hi' on WhatsApp for policy info",
    sms: "LICHELP <pol.no.> to 9222492224",
    sms_label: "SMS for policy info",
    grievance_email: "co_complaints@licindia.com",
    irdai_grievance: "155255",
    website: "licindia.in",
  },
  STAR_HEALTH: {
    company_name: "Star Health Insurance",
    customer_care: "1800 425 2255",
    customer_care_label: "24x7 Customer Care (toll free)",
    customer_care_alt: "1800 102 4477",
    whatsapp: "+91 95976 52225",
    whatsapp_label: "Send 'Hi' on WhatsApp",
    cashless_preauth: "1800 425 2255",
    senior_claims: "044-4002 0888",
    grievance_email: "gro@starhealth.in",
    grievance_phone: "044-4366 4600",
    website: "starhealth.in",
  },
};

// Format helpline block for use in messages or PDFs
function formatHelplineBlock(company) {
  const h = company === "LIC" ? HELPLINES.LIC : HELPLINES.STAR_HEALTH;
  return [
    `${h.company_name} Helplines:`,
    `Phone: ${h.customer_care}`,
    `WhatsApp: ${h.whatsapp} (send 'Hi')`,
    `Website: ${h.website}`,
  ].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HELPLINES, formatHelplineBlock };
}
