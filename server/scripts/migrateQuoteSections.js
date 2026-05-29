#!/usr/bin/env node

/**
 * Backfill QuoteSection rows and quoteSectionId on QuoteLine for existing quotes.
 *
 * - Creates a "General" section per quote that has lines but no sections
 * - Maps distinct lineGroupKey values to named sections when present
 *
 * Usage: node server/scripts/migrateQuoteSections.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteSection = require('../models/QuoteSection');
const { DEFAULT_SECTION_TITLE } = require('../constants/quoteSection');
const { recomputeQuoteAndSectionTotals } = require('../services/quoteSectionService');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

async function migrateQuoteSections() {
  console.log('🚀 Migrating quote sections...\n');

  const uri = getMasterDatabaseUri();
  await mongoose.connect(uri);
  console.log('✅ Connected\n');

  const quotes = await Quote.find({ deletedAt: null }).select('_id organizationId quoteNumber').lean();
  const quoteTotal = quotes.length;
  let quotesProcessed = 0;
  let sectionsCreated = 0;
  let linesUpdated = 0;

  for (const quote of quotes) {
    const organizationId = quote.organizationId;
    const quoteId = quote._id;

    const existingSectionCount = await QuoteSection.countDocuments({ organizationId, quoteId });
    const lines = await QuoteLine.find({ organizationId, quoteId }).lean();
    if (!lines.length && existingSectionCount > 0) continue;

    const sectionByTitle = new Map();
    const sectionByMongoId = new Map();

    if (existingSectionCount === 0) {
      const keys = [
        ...new Set(
          lines
            .map((l) => (l.lineGroupKey ? String(l.lineGroupKey).trim() : null))
            .filter(Boolean)
        )
      ];

      if (!keys.length) {
        const general = await QuoteSection.create({
          organizationId,
          quoteId,
          sectionTitle: DEFAULT_SECTION_TITLE,
          sectionOrder: 0
        });
        sectionByTitle.set(DEFAULT_SECTION_TITLE, general);
        sectionByMongoId.set(String(general._id), general);
        sectionsCreated += 1;
      } else {
        let order = 0;
        for (const title of keys) {
          const section = await QuoteSection.create({
            organizationId,
            quoteId,
            sectionTitle: title,
            sectionOrder: order++
          });
          sectionByTitle.set(title, section);
          sectionByMongoId.set(String(section._id), section);
          sectionsCreated += 1;
        }

        const general = await QuoteSection.create({
          organizationId,
          quoteId,
          sectionTitle: DEFAULT_SECTION_TITLE,
          sectionOrder: order
        });
        sectionByTitle.set(DEFAULT_SECTION_TITLE, general);
        sectionByMongoId.set(String(general._id), general);
        sectionsCreated += 1;
      }
    } else {
      const sections = await QuoteSection.find({ organizationId, quoteId }).lean();
      for (const s of sections) {
        sectionByTitle.set(s.sectionTitle, s);
        sectionByMongoId.set(String(s._id), s);
      }
    }

    const defaultSection =
      sectionByTitle.get(DEFAULT_SECTION_TITLE) ||
      [...sectionByTitle.values()][0] ||
      (await QuoteSection.create({
        organizationId,
        quoteId,
        sectionTitle: DEFAULT_SECTION_TITLE,
        sectionOrder: 0
      }));

    for (const line of lines) {
      if (line.quoteSectionId) continue;

      let target = defaultSection;
      const key = line.lineGroupKey ? String(line.lineGroupKey).trim() : null;
      if (key && sectionByTitle.has(key)) {
        target = sectionByTitle.get(key);
      }

      await QuoteLine.updateOne(
        { _id: line._id, organizationId },
        { $set: { quoteSectionId: target._id || target } }
      );
      linesUpdated += 1;
    }

    if (lines.length || existingSectionCount > 0) {
      await recomputeQuoteAndSectionTotals({ organizationId, quoteId });
    }

    quotesProcessed += 1;
    if (quotesProcessed % 50 === 0) {
      console.log(`  … ${quotesProcessed}/${quoteTotal} quotes processed`);
    }
  }

  console.log(`\n✅ Done. Quotes processed: ${quotesProcessed}, sections created: ${sectionsCreated}, lines updated: ${linesUpdated}`);
  await mongoose.disconnect();
}

migrateQuoteSections().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
