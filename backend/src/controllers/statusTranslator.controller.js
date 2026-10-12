/**
 * @file statusTranslator.controller.js
 * @description Controller endpoint for Feature C: Bilingual Plain-Language Status Translator.
 */

import { statusTranslatorService } from '../services/statusTranslator.service.js';

export const getStatusExplanation = async (req, res, next) => {
  try {
    const target = req.params.reference || req.params.id;
    const lang = req.query.lang || req.query.language || 'en';
    const useAi = req.query.useAi === 'true';

    const explanation = await statusTranslatorService.translateStatus(target, {
      lang,
      useAi
    });

    res.json({
      success: true,
      data: explanation
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getStatusExplanation
};
