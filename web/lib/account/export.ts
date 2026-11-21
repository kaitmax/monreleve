// web/lib/account/export.ts
//
// Everything this product holds about one person. FW26 increment 3.
//
// ============================================================================
// THE TRAIL IS IN IT, AND THAT IS THE POINT
// ============================================================================
//
// An export of the entries alone would hand somebody a list of days they
// already know. What makes the record worth having is `EntryEvent` - when each
// day was first recorded, when it was edited, and what it was before. That is
// the layer SPEC §12 calls "what makes the document evidence rather than
// assertion", and an export without it is a claim the person cannot check.
//
// ============================================================================
// EVERY USER-OWNED TABLE IS EITHER EXPORTED OR EXCLUDED WITH A REASON
// ============================================================================
//
// `EXPORTED` and `EXCLUDED` below partition the schema's user-owned models, and
// a test reads `prisma/schema.prisma` to assert the partition is complete. A
// table added later is a FAILING TEST rather than a silent gap - which is R175
// in its original form: two lists that between them must cover everything, and
// the space between them named rather than left.
//
// The exclusions are credentials and dead adapter tables. Neither is personal
// data in any useful sense, and one of them is a security consideration:
// handing somebody 32-byte token hashes tells them nothing and puts a
// credential-shaped artefact in a file they will email to an accountant.

import { prisma } from '@/lib/db/client';
import { ME_SELECT, serialiseMe } from '@/lib/me/read';
import { DOSSIER_COPY } from '@/lib/fr/dossier';

// ============================================================================
// EVERY CODE TRAVELS WITH THE WORD FOR IT
// ============================================================================
//
// The first version of this export shipped `"kind": "HOME"`, `"portion":
// "FULL"` and `"provenance": "DETECTED_CONFIRMED"`. Reading it as a person
// found the defect the row counts could not: a French reader opening their own
// data met English-ish enum tokens, in a product whose every other surface is
// carefully French.
//
// THE CODE STAYS, because an export is also a machine-readable record and a
// person re-importing it elsewhere needs the stable token. The WORD is added
// beside it. Both, rather than either.
//
// THE WORDS COME FROM DOSSIER_COPY (R206). They are the same ones the document
// prints, so an export and the PDF cannot describe the same day differently.

const KIND_LABEL: Readonly<Record<string, string>> = {
  CH: DOSSIER_COPY.annex.kindSwiss,
  HOME: DOSSIER_COPY.annex.kindHome,
  MISSION_FR: DOSSIER_COPY.annex.kindMissionFrance,
  MISSION_THIRD: DOSSIER_COPY.annex.kindMissionThird,
  ABSENT: DOSSIER_COPY.annex.absenceAutre,
};

const PORTION_LABEL: Readonly<Record<string, string>> = {
  FULL: DOSSIER_COPY.annex.portionFull,
  AM: DOSSIER_COPY.annex.portionMorning,
  PM: DOSSIER_COPY.annex.portionAfternoon,
};

const PROVENANCE_LABEL: Readonly<Record<string, string>> = {
  MANUAL: DOSSIER_COPY.annex.provenanceManual,
  DETECTED_CONFIRMED: DOSSIER_COPY.annex.provenanceConfirmed,
  DETECTED_CORRECTED: DOSSIER_COPY.annex.provenanceCorrected,
};

const ABSENCE_LABEL: Readonly<Record<string, string>> = {
  CONGE: DOSSIER_COPY.annex.absenceConge,
  MALADIE: DOSSIER_COPY.annex.absenceMaladie,
  FERIE: DOSSIER_COPY.annex.absenceFerie,
  AUTRE: DOSSIER_COPY.annex.absenceAutre,
};

/** The word for a code, or the code itself when there is no word for it. */
const wordFor = (
  table: Readonly<Record<string, string>>,
  code: string | null,
): string | null => (code === null ? null : (table[code] ?? code));

/** The tables whose rows appear in an export, and the key each appears under. */
export const EXPORTED = {
  User: 'settings',
  Entry: 'entries',
  EntryEvent: 'trail',
  Device: 'devices',
  DeviceSession: 'sessions',
  // FW27. A record of every reminder this product sent to the person is
  // plainly their data, and it is the only place they can check that the
  // 'exactly one per day' promise was kept.
  ReminderSent: 'reminders',
  // FW-VERIFY (R329). The record of every releve issued to this person is their
  // data too, and the export is the portable copy of it. It carries the code,
  // so the person keeps the means to verify documents they have already shared.
  IssuanceRecord: 'issuances',
  // FW-VERIFY (R331). The dates the holder name changed are the person's data;
  // the former value is not stored, so the export carries only the dates.
  NameChange: 'nameChanges',
  // FW-WEB-ACCOUNT (R899). Every sign-in on the website's account area, for the
  // reason DeviceSession is here: the person can see every time their account
  // was opened, and how each session ended. ADDITIVE (R217): a new key, no
  // field of an existing one moved. The token HASH is not exported, as for
  // DeviceSession's tokens - a credential-shaped artefact in a file somebody
  // e-mails is a liability, not information.
  WebSession: 'webSessions',
} as const;

/**
 * User-owned tables deliberately absent, each naming why.
 *
 * Same shape as R238's allow-list: an entry argues for itself or it is not
 * one. "Not useful" is not a reason; "a credential hash that means nothing to
 * the person and everything to somebody who intercepts the file" is.
 */
export const EXCLUDED: Readonly<Record<string, string>> = {
  SessionToken:
    'hashed credentials. They are not personal data in any useful sense, and a ' +
    'file a person emails to their accountant should not carry credential-shaped ' +
    'artefacts. The SESSIONS they belong to are exported, so the person can still ' +
    'see every device that has been signed in.',
  Account:
    'an Auth.js adapter table with no adapter behind it (R209). It is always ' +
    'empty, and exporting a permanently empty array would tell a reader this ' +
    'product stores something it does not.',
  Session:
    'the other Auth.js adapter table, empty for the same reason (R209). D14 ' +
    'withdrew the web session this would have held.',
  VerificationToken:
    'single-use sign-in tokens keyed by address rather than by user, already ' +
    'expired or consumed by the time anybody exports. Exporting them would be ' +
    'exporting a credential with no informational value.',
};

// ============================================================================
// AN-PRIVACY-RECORD (R1251): EVERY COLUMN OF AN EXPORTED TABLE, NOT ONLY EVERY TABLE
// ============================================================================
//
// EXPORTED / EXCLUDED partition the TABLES. They said nothing about the columns,
// and the columns drifted: /confidentialite named Entry.detectedAt as stored
// (A14, R1231) while this file never carried it, and the page's own record of
// the date an address was confirmed had no field here. A page that names what
// is stored and an export that is "everything this product holds" are two
// descriptions of one fact (R206), so one is derived from the other:
// tests/db/account-export.test.ts takes every column lib/content/personal-data.ts
// maps to a record the page RENDERS, for every exported table, and requires the
// produced file to carry it - and requires every field the file carries to be
// such a column, or the word for one.
//
// A COLUMN LEFT OUT IS LEFT OUT HERE, WITH ITS REASON, and only of one kind: an
// identifier or a credential. The test refuses an exclusion of any other name,
// so a column of data the page names cannot be argued out of the file one at a
// time. The field carrying a column has the COLUMN'S NAME, under the table's
// key in EXPORTED - no aliases, so nothing is mapped by hand.

const ROW_ID =
  'the internal row identifier. It is not a fact about the person, and the ' +
  'export reconciles a row by its natural key (dayDate and portion for a day), ' +
  'as the API does.';
const OWNER_ID =
  'the identifier of the account the row belongs to. Every row in the file ' +
  'belongs to the person exporting it, so it would repeat one opaque value on ' +
  'every row.';
const LINK_ID =
  'an internal link to another row, by its identifier. The rows it would link ' +
  'carry no identifier in the export, so the value could join nothing.';
const CREDENTIAL =
  'a credential: how the server addresses a device or recognises a browser. A ' +
  'file a person e-mails to their accountant should not carry one (the reason ' +
  'SessionToken is excluded as a table).';

/** Columns of exported tables that the file leaves out, each with its reason (R1251). */
export const COLUMNS_NOT_EXPORTED: Readonly<Record<string, string>> = {
  'User.id': ROW_ID,
  'User.organizationId':
    'reserved by D33 with no feature built: no code path writes it, so it is ' +
    'always empty, and a permanently empty field would tell a reader this ' +
    'product stores something it does not (the reason Account is excluded).',
  'Entry.id': ROW_ID,
  'Entry.userId': OWNER_ID,
  'EntryEvent.id': ROW_ID,
  'EntryEvent.userId': OWNER_ID,
  'EntryEvent.entryId': LINK_ID,
  'Device.id': ROW_ID,
  'Device.userId': OWNER_ID,
  'Device.fcmToken': CREDENTIAL,
  'DeviceSession.id': ROW_ID,
  'DeviceSession.userId': OWNER_ID,
  'DeviceSession.deviceId': LINK_ID,
  'ReminderSent.id': ROW_ID,
  'ReminderSent.userId': OWNER_ID,
  'IssuanceRecord.id': ROW_ID,
  'IssuanceRecord.userId': OWNER_ID,
  'NameChange.id': ROW_ID,
  'NameChange.userId': OWNER_ID,
  'WebSession.id': ROW_ID,
  'WebSession.userId': OWNER_ID,
  'WebSession.tokenHash': CREDENTIAL,
};

/**
 * Fields the file carries that are not columns: the word beside a code, each
 * naming the column it is the word for ("every code travels with the word for
 * it", above). Keyed `<export key>.<field>`.
 */
export const DERIVED_FIELDS: Readonly<Record<string, string>> = {
  'entries.portionLabel': 'Entry.portion',
  'entries.kindLabel': 'Entry.kind',
  'entries.absenceLabel': 'Entry.absenceReason',
  'entries.provenanceLabel': 'Entry.provenance',
  'trail.portionLabel': 'EntryEvent.portion',
  'trail.kindLabel': 'EntryEvent.kind',
  'trail.provenanceLabel': 'EntryEvent.provenance',
};

/**
 * The User columns the export carries beyond /api/v1/me's (R1251). ME_FIELDS
 * is not touched: /me is a frozen contract the app parses.
 */
const ACCOUNT_ONLY_SELECT = { email: true, emailVerified: true, createdAt: true } as const;

export interface AccountExport {
  readonly exportedAt: string;
  readonly settings: Record<string, unknown>;
  readonly entries: readonly Record<string, unknown>[];
  readonly trail: readonly Record<string, unknown>[];
  readonly devices: readonly Record<string, unknown>[];
  readonly sessions: readonly Record<string, unknown>[];
  readonly reminders: readonly Record<string, unknown>[];
  readonly issuances: readonly Record<string, unknown>[];
  readonly nameChanges: readonly Record<string, unknown>[];
  readonly webSessions: readonly Record<string, unknown>[];
}

const day = (value: Date): string => value.toISOString().slice(0, 10);
const instant = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

/**
 * Everything, for one person.
 *
 * ORDERED, so two exports of an unchanged account are the same file. An export
 * that shuffled its rows between downloads would be impossible to diff, which
 * is the first thing somebody checking a record wants to do.
 */
export async function buildAccountExport(userId: string): Promise<AccountExport> {
  const [user, entries, trail, devices, sessions, reminders, issuances, nameChanges, webSessions] =
    await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ...ME_SELECT, ...ACCOUNT_ONLY_SELECT },
    }),
    prisma.entry.findMany({
      where: { userId },
      orderBy: [{ dayDate: 'asc' }, { portion: 'asc' }],
    }),
    prisma.entryEvent.findMany({ where: { userId }, orderBy: { recordedAt: 'asc' } }),
    prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.deviceSession.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.reminderSent.findMany({ where: { userId }, orderBy: { sentOn: 'asc' } }),
    prisma.issuanceRecord.findMany({
      where: { userId },
      orderBy: [{ taxYear: 'asc' }, { version: 'asc' }],
    }),
    prisma.nameChange.findMany({ where: { userId }, orderBy: { changedAt: 'asc' } }),
    prisma.webSession.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    // /api/v1/me's fields through its own serialiser (R206), then the three the
    // page names that /me deliberately does not return (R1251). The address is
    // in /me's "THE EMAIL IS NOT" for a polled settings endpoint; this file is
    // the person's own copy of everything held, behind their own token, and the
    // page names « votre adresse e-mail » first in the list.
    settings: {
      ...serialiseMe(user),
      email: user.email,
      emailVerified: instant(user.emailVerified),
      createdAt: user.createdAt.toISOString(),
    },

    entries: entries.map((entry) => ({
      dayDate: day(entry.dayDate),
      portion: entry.portion,
      portionLabel: wordFor(PORTION_LABEL, entry.portion),
      kind: entry.kind,
      kindLabel: wordFor(KIND_LABEL, entry.kind),
      absenceReason: entry.absenceReason,
      absenceLabel: wordFor(ABSENCE_LABEL, entry.absenceReason),
      // R230: the JSON is the RECORD and carries the note byte for byte. Only
      // the CSV neutralises a formula, because only a spreadsheet executes one.
      note: entry.note,
      provenance: entry.provenance,
      provenanceLabel: wordFor(PROVENANCE_LABEL, entry.provenance),
      detectedKind: entry.detectedKind,
      // R1251: the phone's clock at the tap that validated a proposed day
      // (AujourdhuiController.recordDetected, EveningTap), or null for a day
      // entered by hand. The page names it in the provenance record.
      detectedAt: instant(entry.detectedAt),
      firstRecordedAt: entry.firstRecordedAt.toISOString(),
      // R1251: the server's clock at the last write to this row.
      updatedAt: entry.updatedAt.toISOString(),
      clientClaimedAt: instant(entry.clientClaimedAt),
      clientMutationId: entry.clientMutationId,
    })),

    // EVERY COLUMN THE TRAIL HAS. It carries no `note` and no `absenceReason`
    // - the trail records what a day WAS, not what was written beside it - so
    // this is the whole row rather than a selection.
    trail: trail.map((event) => ({
      action: event.action,
      recordedAt: event.recordedAt.toISOString(),
      dayDate: day(event.dayDate),
      portion: event.portion,
      portionLabel: wordFor(PORTION_LABEL, event.portion),
      kind: event.kind,
      kindLabel: wordFor(KIND_LABEL, event.kind),
      provenance: event.provenance,
      provenanceLabel: wordFor(PROVENANCE_LABEL, event.provenance),
      detectedKind: event.detectedKind,
      clientClaimedAt: instant(event.clientClaimedAt),
      clientMutationId: event.clientMutationId,
    })),

    devices: devices.map((device) => ({
      platform: device.platform,
      // R1251: stored with the device, so the person's copy carries them.
      appVersion: device.appVersion,
      lastSeenAt: device.lastSeenAt.toISOString(),
      createdAt: device.createdAt.toISOString(),
      // NO PUSH TOKEN. It is a credential for addressing the device, not a
      // fact about the person, and the same reasoning excludes SessionToken.
    })),

    reminders: reminders.map((reminder) => ({
      sentOn: day(reminder.sentOn),
      sentAt: reminder.sentAt.toISOString(),
    })),

    sessions: sessions.map((session) => ({
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: instant(session.lastUsedAt),
      revokedAt: instant(session.revokedAt),
      revokedReason: session.revokedReason,
    })),

    // FW-VERIFY: every releve issued to this person, current and superseded.
    // The code is included - it is the person's own, and keeping it is what
    // lets them verify a document after an export.
    issuances: issuances.map((record) => ({
      code: record.code,
      taxYear: record.taxYear,
      version: record.version,
      supersededAt: instant(record.supersededAt),
      name: record.name,
      declarableRate: record.declarableRate,
      teleworkDays: record.teleworkDays,
      missionDaysFrance: record.missionDaysFrance,
      missionDaysThirdState: record.missionDaysThirdState,
      periodFraction: record.periodFraction,
      periodStartDate: record.periodStartDate,
      sha256: record.sha256,
      generatedAt: record.generatedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    })),

    // FW-VERIFY (R331): the dates only. There is no former name to carry.
    nameChanges: nameChanges.map((change) => ({
      changedAt: change.changedAt.toISOString(),
    })),

    // FW-WEB-ACCOUNT (R899): no token hash, as for the device sessions.
    webSessions: webSessions.map((session) => ({
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: instant(session.revokedAt),
      revokedReason: session.revokedReason,
    })),
  };
}
