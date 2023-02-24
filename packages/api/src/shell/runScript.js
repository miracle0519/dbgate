const { getLogger } = require('dbgate-tools');
const childProcessChecker = require('../utility/childProcessChecker');
const processArgs = require('../utility/processArgs');
const logger = getLogger();

async function runScript(func) {
  if (processArgs.checkParent) {
    childProcessChecker();
  }
  try {
    await func();
    process.exit(0);
  } catch (err) {
    logger.error('Error running script', err);
    process.exit(1);
  }
}

module.exports = runScript;
