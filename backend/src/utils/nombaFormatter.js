/**
 * Removes characters not accepted by Nomba for account names.
 * Allows only letters, numbers, and spaces.
 */
const sanitizeAccountName = (name = "") => {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Removes special characters from references.
 */
const sanitizeReference = (reference = "") => {
  return reference.replace(/[^a-zA-Z0-9]/g, "");
};

module.exports = {
  sanitizeAccountName,
  sanitizeReference,
};