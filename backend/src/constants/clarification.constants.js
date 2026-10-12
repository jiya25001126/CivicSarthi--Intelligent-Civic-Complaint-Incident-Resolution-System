/**
 * @file clarification.constants.js
 * @description Centralized constants, enums, lifecycles, and translation templates
 * for CivicSarthi Phase 12: Citizen-Initiated Clarification, Reminders & Status Translator.
 */

export const CLARIFICATION_STATUS = Object.freeze({
  OPEN: 'OPEN',
  RESPONDED: 'RESPONDED',
  CLOSED: 'CLOSED'
});
export const CLARIFICATION_STATUSES = CLARIFICATION_STATUS;

export const CLARIFICATION_TYPE = Object.freeze({
  CLARIFICATION: 'CLARIFICATION',
  ADDITIONAL_INFO: 'ADDITIONAL_INFO'
});
export const CLARIFICATION_TYPES = CLARIFICATION_TYPE;

export const CLARIFICATION_BOUNDS = Object.freeze({
  MIN_CONTENT_LENGTH: 5,
  MAX_CONTENT_LENGTH: 2000,
  MIN_RESPONSE_LENGTH: 5,
  MAX_RESPONSE_LENGTH: 2000,
  MAX_ACTIVE_PER_COMPLAINT: 5
});

export const REMINDER_STATUS = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  THROTTLED: 'THROTTLED',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE'
});
export const REMINDER_STATUSES = REMINDER_STATUS;

export const REMINDER_DELIVERY_CHANNEL = Object.freeze({
  IN_APP: 'IN_APP'
});

export const REMINDER_DELIVERY_STATUS = Object.freeze({
  LOGGED_IN_APP: 'LOGGED_IN_APP',
  QUEUED: 'QUEUED'
});

export const REMINDER_CONFIG = Object.freeze({
  DEFAULT_COOLDOWN_HOURS: 24,
  MAX_FOLLOW_UPS: 10
});

/**
 * Status translation templates for deterministic, safe, citizen-friendly explanations.
 * Supported languages: 'en' (English), 'hi' (Hindi).
 */
export const STATUS_TRANSLATION_MAP = Object.freeze({
  SUBMITTED: {
    en: {
      statusLabel: 'Received & Registered',
      meaning: 'Your grievance has been safely logged in CivicSarthi and assigned a tracking reference.',
      whatHappened: 'The platform has accepted your submission and routed it to the triage queue for preliminary verification.',
      nextSteps: 'Please retain your reference number. The assigned department triage officer will assess jurisdiction within 24 to 48 hours.',
      slaGuidance: 'Initial triage review typically begins within 1 business day of registration.'
    },
    hi: {
      statusLabel: 'प्राप्त और पंजीकृत',
      meaning: 'आपकी शिकायत सिविकसारथी में सुरक्षित रूप से दर्ज कर ली गई है और संदर्भ संख्या प्रदान की गई है।',
      whatHappened: 'शिकायत प्रारंभिक जांच के लिए संबंधित विभाग के कार्यदल को अग्रेषित की जा रही है।',
      nextSteps: 'कृपया अपनी संदर्भ संख्या संभाल कर रखें। संबंधित विभाग 24 से 48 घंटों में प्रारंभिक समीक्षा करेगा।',
      slaGuidance: 'पंजीकरण के 1 कार्य दिवस के भीतर प्रारंभिक जांच प्रारंभ हो जाती है।'
    }
  },
  UNDER_REVIEW: {
    en: {
      statusLabel: 'Under Active Department Review',
      meaning: 'A nodal grievance officer is examining your grievance details to verify jurisdiction and determine necessary field actions.',
      whatHappened: 'An officer has opened your complaint file and is assessing the report against department mandates and municipal boundaries.',
      nextSteps: 'No action is required from you at this time. If officers need more specifics, they will request clarification.',
      slaGuidance: 'Review assessment is scheduled for completion within the departmental intake SLA.'
    },
    hi: {
      statusLabel: 'विभागीय समीक्षाधीन',
      meaning: 'एक नोडल अधिकारी आपकी शिकायत की जांच कर रहे हैं ताकि आवश्यक जमीनी कार्रवाई तय की जा सके।',
      whatHappened: 'अधिकारी ने आपकी शिकायत फाइल खोली है और अधिकार क्षेत्र तथा आवश्यक संसाधनों का आकलन कर रहे हैं।',
      nextSteps: 'वर्तमान में आपको किसी अतिरिक्त कार्रवाई की आवश्यकता नहीं है। आवश्यकता पड़ने पर विभाग आपसे संपर्क करेगा।',
      slaGuidance: 'विभागीय समीक्षा समय-सीमा के अनुसार शीघ्र पूर्ण की जाएगी।'
    }
  },
  ASSIGNED: {
    en: {
      statusLabel: 'Assigned to Field Division',
      meaning: 'Your grievance has been officially dispatched to the designated engineering or field inspection unit.',
      whatHappened: 'The case was handed over to the on-ground execution team responsible for your locality.',
      nextSteps: 'The field crew will inspect the site and mobilize resources according to the work schedule.',
      slaGuidance: 'Field investigation and site visit are underway within the scheduled resolution timeline.'
    },
    hi: {
      statusLabel: 'क्षेत्रीय प्रभाग को सौंपा गया',
      meaning: 'आपकी शिकायत संबंधित क्षेत्रीय निरीक्षण या तकनीकी इकाई को आधिकारिक तौर पर सौंप दी गई है।',
      whatHappened: 'मामला आपके इलाके के लिए जिम्मेदार क्षेत्रीय कार्यदल को सौंप दिया गया है।',
      nextSteps: 'क्षेत्रीय टीम स्थल का निरीक्षण करेगी और समाधान हेतु आवश्यक संसाधन जुटाएगी।',
      slaGuidance: 'निर्धारित कार्य-अवधि के भीतर स्थल निरीक्षण और समाधान प्रक्रिया जारी है।'
    }
  },
  IN_PROGRESS: {
    en: {
      statusLabel: 'Work In Progress',
      meaning: 'Remediation works, field repairs, or administrative procedures are actively taking place on site.',
      whatHappened: 'The assigned crew has initiated physical remediation or corrective operations.',
      nextSteps: 'You can check back periodically for progress updates, or send a reminder if no progress is made past the expected deadline.',
      slaGuidance: 'Remediation is progressing toward the target SLA resolution date.'
    },
    hi: {
      statusLabel: 'समाधान कार्य प्रगति पर',
      meaning: 'स्थल पर मरम्मत, सुधार या प्रशासनिक प्रक्रियाएं सक्रिय रूप से चल रही हैं।',
      whatHappened: 'संबंधित कार्यदल ने जमीनी स्तर पर मरम्मत या सुधारात्मक कार्य शुरू कर दिया है।',
      nextSteps: 'आप समय-समय पर स्थिति देख सकते हैं। यदि कार्य में अनुचित देरी हो तो फॉलो-अप रिमाइंडर भेज सकते हैं।',
      slaGuidance: 'समाधान कार्य निर्धारित समय-सीमा के भीतर पूर्ण करने का प्रयास जारी है।'
    }
  },
  AWAITING_INFORMATION: {
    en: {
      statusLabel: 'Citizen Clarification Needed',
      meaning: 'The assigned officer requires additional details, photographs, or landmark descriptions from you to proceed.',
      whatHappened: 'The investigating officer identified missing information necessary to pinpoint or remediate the issue.',
      nextSteps: 'Please submit the requested clarification or additional information using the Clarification section below so work can resume.',
      slaGuidance: 'The resolution timeline is temporarily on hold pending citizen response.'
    },
    hi: {
      statusLabel: 'नागरिक से अतिरिक्त जानकारी अपेक्षित',
      meaning: 'जांच अधिकारी को आगे बढ़ने के लिए आपसे अतिरिक्त विवरण, चित्र या स्थल की पहचान की आवश्यकता है।',
      whatHappened: 'अधिकारी ने पाया कि समस्या के सटीक समाधान के लिए कुछ अतिरिक्त जानकारी जरूरी है।',
      nextSteps: 'कृपया नीचे दिए गए स्पष्टीकरण विकल्प का उपयोग करके मांगी गई जानकारी तुरंत प्रदान करें।',
      slaGuidance: 'नागरिक की प्रतिक्रिया प्राप्त होने तक समाधान समय-सीमा अस्थायी रूप से रुकी हुई है।'
    }
  },
  RESOLVED: {
    en: {
      statusLabel: 'Remediation Completed & Reported Resolved',
      meaning: 'The department has completed corrective action and officially marked the grievance as remediated.',
      whatHappened: 'The field team completed on-ground repairs and verified resolution according to quality standards.',
      nextSteps: 'Please verify the on-ground outcome. If satisfied, provide feedback; if the issue persists, you may request a controlled reopening or lodge an appeal.',
      slaGuidance: 'Remediation has concluded. Citizen confirmation window is active.'
    },
    hi: {
      statusLabel: 'समाधान पूर्ण और सत्यापित',
      meaning: 'विभाग ने आवश्यक सुधारात्मक कार्य पूरा कर लिया है और शिकायत को हल के रूप में दर्ज किया है।',
      whatHappened: 'क्षेत्रीय टीम ने मरम्मत कार्य पूरा कर लिया है और गुणवत्ता मानकों के अनुसार समाधान सत्यापित किया है।',
      nextSteps: 'कृपया स्थल की जांच करें। यदि आप संतुष्ट हैं तो फीडबैक दें; यदि समस्या बनी हुई है तो पुन: खोलने या अपील करने का विकल्प उपलब्ध है।',
      slaGuidance: 'कार्य पूरा हो चुका है। नागरिक सत्यापन अवधि सक्रिय है।'
    }
  },
  CLOSED: {
    en: {
      statusLabel: 'Officially Closed',
      meaning: 'The grievance case file has been formally concluded following resolution confirmation or administrative closure.',
      whatHappened: 'The grievance lifecycle has reached final archival status following citizen verification or standard closure procedures.',
      nextSteps: 'The case file is closed. If a related issue arises in the future, you can submit a new grievance or refer to this closed reference.',
      slaGuidance: 'Lifecycle concluded; no further SLA clock is active.'
    },
    hi: {
      statusLabel: 'औपचारिक रूप से बंद',
      meaning: 'समाधान की पुष्टि या प्रशासनिक प्रक्रिया पूर्ण होने के बाद शिकायत फाइल आधिकारिक रूप से बंद कर दी गई है।',
      whatHappened: 'नागरिक सत्यापन अथवा मानक समापन नियमों के तहत शिकायत का जीवनचक्र समाप्त हो गया है।',
      nextSteps: 'केस फाइल बंद है। भविष्य में संबंधित समस्या उत्पन्न होने पर आप नई शिकायत दर्ज कर सकते हैं।',
      slaGuidance: 'प्रक्रिया पूर्ण हो चुकी है; कोई समय-सीमा सक्रिय नहीं है।'
    }
  },
  REOPENED: {
    en: {
      statusLabel: 'Reopened for Follow-Up Inspection',
      meaning: 'The grievance was reopened following citizen dispute or verification indicating the defect persisted.',
      whatHappened: 'A supervisory officer reviewed the reopening request and approved supplementary remediation.',
      nextSteps: 'The department has re-queued the issue for field inspection and expedited remediation.',
      slaGuidance: 'Expedited reopening SLA is active for priority re-inspection.'
    },
    hi: {
      statusLabel: 'पुन: खोला गया (पुनर्निरीक्षण)',
      meaning: 'नागरिक द्वारा समस्या बने रहने की सूचना दिए जाने पर शिकायत को पुन: जांच हेतु खोल दिया गया है।',
      whatHappened: 'पर्यवेक्षी अधिकारी ने पुन: खोलने के अनुरोध की समीक्षा की और पूरक समाधान को मंजूरी दी।',
      nextSteps: 'विभाग ने प्राथमिकता के आधार पर स्थल के पुनर्निरीक्षण के लिए मामला फिर से सौंप दिया है।',
      slaGuidance: 'त्वरित समाधान समय-सीमा के तहत प्राथमिकता से कार्य किया जा रहा है।'
    }
  }
});
