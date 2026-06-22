/**
 * Case-bound live chat APIs are deprecated (Live Chat addon owns sessions).
 */
function deprecateCaseChatApi(req, res) {
  console.warn('[DEPRECATED] Case-bound live chat API', {
    method: req.method,
    path: req.originalUrl,
    organizationId: req.user?.organizationId,
  });
  return res.status(410).json({
    success: false,
    code: 'LIVE_CHAT_CASE_API_DEPRECATED',
    message: 'Live Chat is no longer available on case records. Install and use the Live Chat addon.',
  });
}

module.exports = {
  deprecateCaseChatApi,
};
