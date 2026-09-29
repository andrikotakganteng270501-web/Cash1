const donationBuffer = [];
const processedIds   = new Set();
const MAX_BUFFER     = 1000;
const MAX_IDS        = 5000;

function addToBuffer(donation) {
  if (processedIds.has(donation.id)) return false;

  if (processedIds.size >= MAX_IDS) {
    const iter = processedIds.values();
    for (let i = 0; i < 500; i++) processedIds.delete(iter.next().value);
  }
  if (donationBuffer.length >= MAX_BUFFER) {
    donationBuffer.shift();
  }

  donationBuffer.push(donation);
  processedIds.add(donation.id);
  return true;
}

function removeFromBuffer(id) {
  const idx = donationBuffer.findIndex(d => d.id === id);
  if (idx !== -1) donationBuffer.splice(idx, 1);
}

module.exports = { donationBuffer, processedIds, addToBuffer, removeFromBuffer };
