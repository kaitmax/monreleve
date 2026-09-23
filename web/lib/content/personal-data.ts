// web/lib/content/personal-data.ts
//
// What this service stores about a person, column by column, and which
// sentence of /confidentialite discloses it.
//
// ============================================================================
// WHY THIS EXISTS: « pour votre compte et pour lui seul » IS A CLOSED LIST
// ============================================================================
//
// The notice enumerates what is recorded and closes the enumeration. A closed
// list is not merely incomplete when something is added - it becomes FALSE.
// An open list ("notamment") would degrade gracefully; this one does not, and
// it is written that way on purpose because "and nothing else" is the whole
// promise.
//
// FW22 broke it. Sign-in started storing sessions and hashed credentials, and
// the list still ended before them. Nothing failed, because the list was
// maintained by hand and a hand-maintained list has no relationship to the
// schema.
//
// THE DRIFT HAS A DIRECTION, AND IT IS THE DANGEROUS ONE. Every task that
// adds a column - FW23's entries routes, FW26's deletion, FW27's scheduler,
// AN5's detection - adds something stored before it adds a sentence, if it
// adds a sentence at all. So the notice drifts towards claiming LESS is held
// than is held, which is the failure a privacy notice cannot afford. Claiming
// MORE is safe by comparison: a reader told their canton is recorded before
// any code writes it has been over-warned, not misled about what is held.
//
// So the enumeration is DERIVED rather than remembered. This file maps every
// stored column to a disclosure, and tests/unit/content/personal-data.test.ts
// asserts three things:
//
//   1. every column in prisma/schema.prisma appears here - a new column is a
//      FAILING TEST rather than a silent falsehood;
//   2. every disclosure named here appears in the notice's copy;
//   3. NOT_PERSONAL entries are justified one by one, so the escape hatch is
//      a list of decisions rather than a hole.
//
// It is the same repair /sources needed after miscounting itself by six: a
// published count of something the code knows must be read from the code.
//
// ============================================================================
// WHAT COUNTS AS PERSONAL DATA HERE
// ============================================================================
//
// Broadly, and deliberately so. A column is personal if it is ABOUT an
// identifiable person - which, on a table keyed to a user, is very nearly
// everything, including opaque ids, timestamps and per-person settings. An
// audit of all sixty-odd columns in this schema (FW22, six agents, every
// not-personal classification adversarially challenged) returned NOT ONE
// column that is genuinely not personal data.
//
// That is not a failure of the classification. It is what a schema looks like
// when every table exists to hold one person's record.

import { DISCLOSED_RECORDS } from '@/lib/fr/confidentialite';

/**
 * The disclosures the notice makes, taken FROM THE NOTICE.
 *
 * THIS USED TO HOLD COPIES OF THE FRENCH, and R126 refused it: French
 * written twice is French that drifts, and the copy the page renders would
 * have stopped being the copy this guard checks - the guard passing all the
 * way through.
 *
 * The tempting fix was to pick apostrophe-free substrings so the duplication
 * guard could not see them. That is evasion: the duplication survives and
 * only the detector is blinded. R181 - the text is DERIVED from the thing it
 * describes, never transcribed alongside it. So the sentences live in
 * lib/fr/confidentialite.ts, keyed, and this file names keys.
 */
export type Disclosure = keyof typeof DISCLOSED_RECORDS;

/**
 * A column that is NOT personal data, with the reason it is not.
 *
 * AN EXPLICIT LIST OF DECISIONS, NOT AN ESCAPE HATCH. Every entry is a claim
 * somebody can disagree with, which is the point - an unexplained exemption
 * is how a column stops being disclosed without anyone choosing that.
 *
 * IT IS CURRENTLY EMPTY, and that is the honest outcome of the audit rather
 * than an oversight. Every table here is keyed to a person; a column on such
 * a table is about that person even when its value looks like plumbing.
 */
export const NOT_PERSONAL: Readonly<Record<string, string>> = {};

/**
 * Every stored column, and what discloses it.
 *
 * Keyed `Model.column`. Relation fields are not stored columns and are not
 * listed; the test reads the schema the same way.
 */
export const PERSONAL_DATA: Readonly<Record<string, Disclosure>> = {
  // ---- The alert list. Disclosed by the PUBLIC SITE section, because it is
  // not part of "votre compte" - somebody on the list has no account.
  'AlertSubscriber.id': 'alertList',
  'AlertSubscriber.email': 'alertList',
  'AlertSubscriber.source': 'alertList',
  'AlertSubscriber.confirmationTokenHash': 'alertList',
  'AlertSubscriber.unsubscribeTokenHash': 'alertList',
  'AlertSubscriber.confirmationExpiresAt': 'alertList',
  'AlertSubscriber.confirmedAt': 'alertList',
  'AlertSubscriber.unsubscribedAt': 'alertList',
  'AlertSubscriber.createdAt': 'alertList',

  // ---- The person.
  'User.id': 'email',
  'User.email': 'email',
  'User.emailVerified': 'emailConfirmed',
  'User.name': 'email',
  'User.organizationId': 'profile',
  'User.canton': 'profile',
  'User.employmentRate': 'profile',
  'User.denominatorKind': 'profile',
  'User.exactTotalWorkDays': 'profile',
  'User.granularity': 'profile',
  'User.loggingMode': 'profile',
  'User.detectionConsentAt': 'profile',
  'User.activityStartDate': 'profile',
  'User.reminderTime': 'notificationToken',
  'User.reminderEnabled': 'notificationToken',
  'User.createdAt': 'email',

  // ---- Their device (D21).
  'Device.id': 'notificationToken',
  'Device.userId': 'notificationToken',
  'Device.fcmToken': 'notificationToken',
  'Device.platform': 'notificationToken',
  'Device.appVersion': 'notificationToken',
  'Device.lastSeenAt': 'notificationToken',
  'Device.createdAt': 'notificationToken',

  // ---- The declared day.
  'Entry.id': 'day',
  'Entry.userId': 'day',
  'Entry.dayDate': 'day',
  'Entry.portion': 'day',
  'Entry.kind': 'day',
  'Entry.absenceReason': 'day',
  'Entry.clientMutationId': 'day',
  'Entry.note': 'day',
  'Entry.provenance': 'provenance',
  'Entry.detectedKind': 'provenance',
  'Entry.detectedAt': 'provenance',
  'Entry.clientClaimedAt': 'timestamps',
  'Entry.firstRecordedAt': 'timestamps',
  'Entry.updatedAt': 'timestamps',

  // ---- The append-only trail.
  'EntryEvent.id': 'history',
  'EntryEvent.userId': 'history',
  'EntryEvent.entryId': 'history',
  'EntryEvent.action': 'history',
  'EntryEvent.kind': 'history',
  'EntryEvent.provenance': 'history',
  'EntryEvent.detectedKind': 'history',
  'EntryEvent.dayDate': 'history',
  'EntryEvent.portion': 'history',
  // R219: the mutation that produced this event. Disclosed as 'history' like
  // the rest of the event record, not as 'day' like Entry.clientMutationId -
  // the category describes WHICH RECORD holds the column, and this one is the
  // modification trail. It is the client's own opaque id and carries nothing
  // about the person, but "carries nothing" is not a reason to leave it
  // undisclosed: the notice enumerates what is STORED.
  'EntryEvent.clientMutationId': 'history',
  'EntryEvent.recordedAt': 'timestamps',
  'EntryEvent.clientClaimedAt': 'timestamps',

  // ---- FW22: sessions and credentials. The three that broke the closed list.
  // ---- FW27: the reminder log. Disclosed by , which was
  // added to the notice in the same change - the enumeration is closed, so
  // storing these without a line there would have been a published
  // falsehood rather than a gap.
  'ReminderSent.id': 'reminderLog',
  'ReminderSent.userId': 'reminderLog',
  'ReminderSent.sentOn': 'reminderLog',
  'ReminderSent.sentAt': 'reminderLog',

  'DeviceSession.id': 'sessions',
  'DeviceSession.userId': 'sessions',
  'DeviceSession.deviceId': 'sessions',
  'DeviceSession.createdAt': 'sessions',
  'DeviceSession.lastUsedAt': 'sessions',
  'DeviceSession.revokedAt': 'sessions',
  'DeviceSession.revokedReason': 'sessions',

  'SessionToken.id': 'credentials',
  'SessionToken.sessionId': 'credentials',
  'SessionToken.kind': 'credentials',
  'SessionToken.tokenHash': 'credentials',
  'SessionToken.expiresAt': 'credentials',
  'SessionToken.createdAt': 'credentials',
  'SessionToken.consumedAt': 'credentials',

  // The address plus a hashed link, held while the link is outstanding. It
  // exists BEFORE any account does, which is why it is disclosed by the
  // public-site sentence rather than by the account enumeration: there is no
  // compte for it to belong to, and for an address nobody signs in with there
  // never will be.
  'VerificationToken.identifier': 'signInLink',
  'VerificationToken.token': 'signInLink',
  'VerificationToken.expires': 'signInLink',

  // ---- FW21 RESIDUE, WITH NO ADAPTER BEHIND IT ANY MORE (R209). These were
  // written from the Auth.js Prisma adapter's published schema and verified
  // against the installed adapter in FW22 (P4-1). R209 then removed the
  // adapter permanently, so nothing requires their shape and nothing writes
  // them: Account and Session are the only two tables here with no writer.
  //
  // Q70 DROPPED Account's SEVEN OAuth COLUMNS - refresh_token, access_token,
  // expires_at, token_type, scope, id_token, session_state - under R187: an
  // unused column is a promise to a client that will eventually read it.
  //
  // AND THAT MADE THIS BLOCK HONEST. All seven mapped to 'credentials', whose
  // sentence promises « sous forme d'empreinte et jamais en clair ». An OAuth
  // access_token is stored as issued, in clear, so the notice was describing a
  // property those columns did not have. What remains under 'credentials' -
  // SessionToken's hashes and Session.sessionToken - genuinely is hashed.
  'Account.id': 'signInLink',
  'Account.userId': 'signInLink',
  'Account.type': 'signInLink',
  'Account.provider': 'signInLink',
  'Account.providerAccountId': 'signInLink',

  'Session.id': 'sessions',
  'Session.sessionToken': 'credentials',
  'Session.userId': 'sessions',
  'Session.expires': 'sessions',
};
