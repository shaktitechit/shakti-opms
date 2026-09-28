/**
 * @fileoverview Email Provider Resolver.
 * Resolves the appropriate email provider (Microsoft Graph, Gmail API, or SMTP)
 * based on sender address, account configuration in DB, and environment settings.
 * @module modules/messages/providers/emailProvider.resolver
 */
const MicrosoftGraphProvider = require('./microsoftGraph.provider');
const GmailProvider = require('./gmail.provider');
const SmtpProvider = require('./smtp.provider');
const { getModels } = require('../../../data/mongoRegistry');
const { EmailError, EmailErrorCodes } = require('../errors/emailErrors');
const { logger } = require('../../../config/logger');
const mongoose = require('mongoose');

/**
 * Extracts clean email address from string (e.g. "Name <email@example.com>" -> "email@example.com").
 */
function parseEmailAddressOnly(val) {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  if (str.includes('@')) {
    return str.split(/\s+/).pop().replace(/[<>]/g, '').trim().toLowerCase();
  }
  return '';
}

class EmailProviderResolver {
  constructor() {
    this.microsoftProvider = new MicrosoftGraphProvider();
    this.gmailProvider = new GmailProvider();
    this.smtpProvider = new SmtpProvider();
  }

  /**
   * Resolves the provider and account details for a given sender email address.
   * @param {string} from - Sender email address.
   * @param {string} [preferredProvider] - Optional explicitly requested provider ('microsoft' | 'google' | 'smtp').
   * @returns {Promise<{ providerName: string, provider: object, account: object|null }>}
   */
  async resolve(from, preferredProvider = null) {
    const fromEmail = parseEmailAddressOnly(from);
    const { EmailAccount } = getModels();
    const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

    let account = null;

    // 1. Check database for configured sender account
    if (EmailAccount && fromEmail && isDbConnected) {
      try {
        account = await EmailAccount.findOne({ email: fromEmail }).lean({ getters: true });
      } catch (err) {
        logger.warn(`[EmailProviderResolver] DB lookup failed for ${fromEmail}: ${err.message}`);
      }
    }

    // If explicit provider was requested
    if (preferredProvider) {
      if (preferredProvider === 'google') {
        if (!account && fromEmail && isDbConnected && EmailAccount) {
          account = await EmailAccount.findOne({ provider: 'google', status: 'active' }).lean({ getters: true });
        }
        if (!account) {
          throw new EmailError(
            EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
            `No authorized Google account found for sender ${fromEmail || 'unknown'}. Please authorize via Google OAuth first.`,
            401
          );
        }
        return {
          providerName: 'google',
          provider: this.gmailProvider,
          account,
        };
      }

      if (preferredProvider === 'microsoft') {
        return {
          providerName: 'microsoft',
          provider: this.microsoftProvider,
          account,
        };
      }

      if (preferredProvider === 'smtp') {
        return {
          providerName: 'smtp',
          provider: this.smtpProvider,
          account,
        };
      }
    }

    // 2. If DB account exists, route according to registered provider
    if (account) {
      if (account.status === 'revoked' || account.status === 'inactive') {
        throw new EmailError(
          EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
          `The email account ${fromEmail} is marked as ${account.status}. Re-authorization required.`,
          401
        );
      }

      if (account.provider === 'google') {
        return {
          providerName: 'google',
          provider: this.gmailProvider,
          account,
        };
      }

      if (account.provider === 'microsoft') {
        return {
          providerName: 'microsoft',
          provider: this.microsoftProvider,
          account,
        };
      }

      if (account.provider === 'smtp') {
        return {
          providerName: 'smtp',
          provider: this.smtpProvider,
          account,
        };
      }
    }

    // 3. If from is @gmail.com or @googlemail.com, route to Google Gmail API
    const isGmailDomain = fromEmail.endsWith('@gmail.com') || fromEmail.endsWith('@googlemail.com');
    if (isGmailDomain) {
      // Look for any active Google account in DB if exact match wasn't found
      if (!account && EmailAccount && isDbConnected) {
        account = await EmailAccount.findOne({ provider: 'google', status: 'active' }).lean({ getters: true });
      }

      if (!account) {
        throw new EmailError(
          EmailErrorCodes.EMAIL_ACCOUNT_NOT_AUTHORIZED,
          `Google account ${fromEmail} has not been authorized. Please connect your Google account via OAuth.`,
          401
        );
      }

      return {
        providerName: 'google',
        provider: this.gmailProvider,
        account,
      };
    }

    // 4. Default: preserve Microsoft Graph behavior if configured
    if (this.microsoftProvider.isConfigured()) {
      return {
        providerName: 'microsoft',
        provider: this.microsoftProvider,
        account: null,
      };
    }

    // 5. Fallback to SMTP if configured
    if (this.smtpProvider.isConfigured()) {
      return {
        providerName: 'smtp',
        provider: this.smtpProvider,
        account: null,
      };
    }

    // 6. If Google is configured and an active account exists
    if (EmailAccount && isDbConnected) {
      const anyGoogleAccount = await EmailAccount.findOne({ provider: 'google', status: 'active' }).lean({ getters: true });
      if (anyGoogleAccount) {
        return {
          providerName: 'google',
          provider: this.gmailProvider,
          account: anyGoogleAccount,
        };
      }
    }

    throw new EmailError(
      EmailErrorCodes.EMAIL_PROVIDER_NOT_CONFIGURED,
      'No email provider (Microsoft Graph, Gmail API, or SMTP) is configured.',
      500
    );
  }
}

module.exports = new EmailProviderResolver();
