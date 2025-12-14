process.env.NODE_ENV = 'test';

// Mock nodemailer before requiring the email module
jest.mock('nodemailer');

describe('Email Service', () => {
  let emailUtils;
  let mockTransporter;
  let mockSendMail;
  let nodemailer;

  beforeEach(() => {
    // Clear all mocks and modules
    jest.resetModules();
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.EMAIL_ENABLED;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM_NAME;

    // Setup mock transporter
    mockSendMail = jest.fn();
    mockTransporter = {
      sendMail: mockSendMail
    };

    // Get nodemailer after resetModules
    nodemailer = require('nodemailer');
    nodemailer.createTransport = jest.fn(() => mockTransporter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initEmail', () => {
    it('should return null when EMAIL_ENABLED is not set to true', () => {
      process.env.EMAIL_ENABLED = 'false';
      
      emailUtils = require('../src/utils/email');
      const result = emailUtils.initEmail();

      expect(result).toBeNull();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should return null when EMAIL_ENABLED is not set', () => {
      // EMAIL_ENABLED is undefined
      
      emailUtils = require('../src/utils/email');
      const result = emailUtils.initEmail();

      expect(result).toBeNull();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it('should initialize transporter when EMAIL_ENABLED is true', () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.gmail.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'test@example.com';
      process.env.SMTP_PASS = 'test-password';

      emailUtils = require('../src/utils/email');
      const result = emailUtils.initEmail();

      expect(result).toBe(mockTransporter);
      // The module may initialize on load, so check that it was called at least once
      expect(nodemailer.createTransport).toHaveBeenCalled();
      // Check the last call to see if it matches our expected config
      const lastCall = nodemailer.createTransport.mock.calls[nodemailer.createTransport.mock.calls.length - 1][0];
      expect(lastCall.host).toBe('smtp.gmail.com');
      expect(lastCall.port).toBe(587);
      expect(lastCall.secure).toBe(false);
      expect(lastCall.auth.user).toBe('test@example.com');
      expect(lastCall.auth.pass).toBe('test-password');
    });

    it('should use default SMTP settings when not provided', () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'test@example.com';
      process.env.SMTP_PASS = 'test-password';

      emailUtils = require('../src/utils/email');
      const result = emailUtils.initEmail();

      expect(result).toBe(mockTransporter);
      // The module may initialize on load, so check that it was called at least once
      expect(nodemailer.createTransport).toHaveBeenCalled();
      // Check the last call to see if it matches our expected config
      const lastCall = nodemailer.createTransport.mock.calls[nodemailer.createTransport.mock.calls.length - 1][0];
      expect(lastCall.host).toBe('smtp.gmail.com');
      expect(lastCall.port).toBe(587);
      expect(lastCall.secure).toBe(false);
      expect(lastCall.auth.user).toBe('test@example.com');
      expect(lastCall.auth.pass).toBe('test-password');
    });

    it('should handle secure connection when SMTP_SECURE is true', () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '465';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'test@example.com';
      process.env.SMTP_PASS = 'test-password';

      emailUtils = require('../src/utils/email');
      const result = emailUtils.initEmail();

      expect(result).toBe(mockTransporter);
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: {
          user: 'test@example.com',
          pass: 'test-password'
        }
      });
    });

    it('should handle errors during initialization', () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'test@example.com';
      process.env.SMTP_PASS = 'test-password';

      // Mock createTransport to throw an error
      nodemailer.createTransport = jest.fn(() => {
        throw new Error('Connection failed');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      emailUtils = require('../src/utils/email');
      const result = emailUtils.initEmail();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize email transporter:',
        'Connection failed'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('sendItineraryCreatedEmail', () => {
    const mockItinerary = {
      title: 'Paris Adventure',
      destination: 'Paris, France',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-10'),
      activities: [
        { time: '10:00', description: 'Visit Eiffel Tower', location: 'Eiffel Tower' },
        { time: '14:00', description: 'Lunch at cafe', location: 'City Center' }
      ]
    };

    const userEmail = 'user@example.com';
    const userName = 'John Doe';

    it('should return false when email is not enabled', async () => {
      process.env.EMAIL_ENABLED = 'false';

      emailUtils = require('../src/utils/email');
      const result = await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should return false when transporter is not initialized', async () => {
      // EMAIL_ENABLED is not set
      emailUtils = require('../src/utils/email');
      
      const result = await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should send email successfully when configured', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';
      process.env.EMAIL_FROM_NAME = 'TMTC Travel';

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id-123'
      });

      emailUtils = require('../src/utils/email');
      // Initialize transporter first
      emailUtils.initEmail();

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe(userEmail);
      expect(mailOptions.from).toContain('TMTC Travel');
      expect(mailOptions.from).toContain('sender@example.com');
      expect(mailOptions.subject).toContain('Paris Adventure');
      expect(mailOptions.html).toContain(userName);
      expect(mailOptions.html).toContain('Paris Adventure');
      expect(mailOptions.html).toContain('Paris, France');
      expect(mailOptions.html).toContain('2 planned');
      expect(mailOptions.text).toContain(userName);
      expect(mailOptions.text).toContain('Paris Adventure');
      expect(mailOptions.text).toContain('Paris, France');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Itinerary creation email sent:',
        'test-message-id-123'
      );

      consoleLogSpy.mockRestore();
    });

    it('should handle itinerary without activities', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';

      const itineraryWithoutActivities = {
        ...mockItinerary,
        activities: []
      };

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id-456'
      });

      emailUtils = require('../src/utils/email');
      emailUtils.initEmail();

      const result = await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        itineraryWithoutActivities
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('0 planned');
      expect(mailOptions.text).toContain('0 planned');
    });

    it('should handle itinerary with undefined activities', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';

      const itineraryWithoutActivities = {
        ...mockItinerary,
        activities: undefined
      };

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id-789'
      });

      emailUtils = require('../src/utils/email');
      emailUtils.initEmail();

      const result = await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        itineraryWithoutActivities
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('0 planned');
    });

    it('should use default EMAIL_FROM_NAME when not set', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';
      // EMAIL_FROM_NAME is not set

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      emailUtils = require('../src/utils/email');
      emailUtils.initEmail();

      await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.from).toContain('TMTC Travel');
    });

    it('should handle email sending errors gracefully', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';

      const error = new Error('SMTP connection failed');
      mockSendMail.mockRejectedValue(error);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      emailUtils = require('../src/utils/email');
      emailUtils.initEmail();

      const result = await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      expect(result).toBe(false);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error sending itinerary creation email:',
        'SMTP connection failed'
      );

      consoleErrorSpy.mockRestore();
    });

    it('should format dates correctly in email', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      emailUtils = require('../src/utils/email');
      emailUtils.initEmail();

      await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      const startDate = new Date(mockItinerary.startDate).toLocaleDateString();
      const endDate = new Date(mockItinerary.endDate).toLocaleDateString();

      expect(mailOptions.html).toContain(startDate);
      expect(mailOptions.html).toContain(endDate);
      expect(mailOptions.text).toContain(startDate);
      expect(mailOptions.text).toContain(endDate);
    });

    it('should include all itinerary details in email content', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      emailUtils = require('../src/utils/email');
      emailUtils.initEmail();

      await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const mailOptions = mockSendMail.mock.calls[0][0];
      
      // Check HTML content
      expect(mailOptions.html).toContain(mockItinerary.title);
      expect(mailOptions.html).toContain(mockItinerary.destination);
      expect(mailOptions.html).toContain(userName);
      expect(mailOptions.html).toContain('Itinerary Created Successfully');
      expect(mailOptions.html).toContain('Happy travels');
      
      // Check text content
      expect(mailOptions.text).toContain(mockItinerary.title);
      expect(mailOptions.text).toContain(mockItinerary.destination);
      expect(mailOptions.text).toContain(userName);
      expect(mailOptions.text).toContain('Itinerary Details');
    });

    it('should try to initialize transporter if not already initialized', async () => {
      process.env.EMAIL_ENABLED = 'true';
      process.env.SMTP_USER = 'sender@example.com';
      process.env.SMTP_PASS = 'test-password';

      mockSendMail.mockResolvedValue({
        messageId: 'test-message-id'
      });

      emailUtils = require('../src/utils/email');
      // Don't call initEmail() - let sendItineraryCreatedEmail initialize it
      // But we need to ensure transporter is null first
      // The module might have initialized it, so we need to check the behavior

      const result = await emailUtils.sendItineraryCreatedEmail(
        userEmail,
        userName,
        mockItinerary
      );

      // The function should try to initialize and send
      expect(result).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });
});

