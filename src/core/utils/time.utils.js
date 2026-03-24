/**
 * Checks if the current time in Ethiopia (UTC+3) is within the opening and closing hours.
 * @param {string} openTime - Format "HH:mm" (e.g., "08:00")
 * @param {string} closeTime - Format "HH:mm" (e.g., "20:00")
 * @returns {boolean}
 */
export const isCurrentlyOpen = (openTime, closeTime) => {
  if (!openTime || !closeTime) return true; // If no schedule is set, rely purely on manual toggle

  // Get current time in East Africa Time (UTC+3)
  const now = new Date();
  const eatTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  
  const currentHour = eatTime.getUTCHours();
  const currentMinute = eatTime.getUTCMinutes();
  const currentTimeVal = currentHour * 60 + currentMinute;

  const [openH, openM] = openTime.split(':').map(Number);
  const openTimeVal = openH * 60 + openM;

  const [closeH, closeM] = closeTime.split(':').map(Number);
  const closeTimeVal = closeH * 60 + closeM;

  // Handle standard daytime hours (e.g., 08:00 to 20:00)
  if (openTimeVal < closeTimeVal) {
    return currentTimeVal >= openTimeVal && currentTimeVal <= closeTimeVal;
  } 
  
  // Handle overnight hours (e.g., 20:00 to 02:00)
  return currentTimeVal >= openTimeVal || currentTimeVal <= closeTimeVal;
};