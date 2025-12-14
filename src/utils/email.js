const nodemailer = require('nodemailer');

// Create reusable transporter
let transporter = null;

const initEmail = () => {
  // Check if email is enabled
  if (process.env.EMAIL_ENABLED !== 'true') {
    console.log('Email notifications are disabled');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('Email transporter initialized');
    return transporter;
  } catch (error) {
    console.error('Failed to initialize email transporter:', error.message);
    return null;
  }
};

// Send email notification when itinerary is created
const sendItineraryCreatedEmail = async (userEmail, userName, itinerary) => {
  if (!transporter) {
    // Try to initialize if not already done
    if (!initEmail()) {
      console.log('Email not configured, skipping email notification');
      return false;
    }
  }

  if (!transporter) {
    return false;
  }

  try {
    const startDate = new Date(itinerary.startDate).toLocaleDateString();
    const endDate = new Date(itinerary.endDate).toLocaleDateString();
    const activitiesCount = itinerary.activities?.length || 0;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'TMTC Travel'}" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `Your Itinerary "${itinerary.title}" Has Been Created!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .itinerary-details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #555; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Itinerary Created Successfully!</h1>
            </div>
            <div class="content">
              <p>Hi ${userName},</p>
              <p>Great news! Your travel itinerary has been created successfully.</p>
              
              <div class="itinerary-details">
                <div class="detail-row">
                  <span class="label">Title:</span> ${itinerary.title}
                </div>
                <div class="detail-row">
                  <span class="label">Destination:</span> ${itinerary.destination}
                </div>
                <div class="detail-row">
                  <span class="label">Start Date:</span> ${startDate}
                </div>
                <div class="detail-row">
                  <span class="label">End Date:</span> ${endDate}
                </div>
                <div class="detail-row">
                  <span class="label">Activities:</span> ${activitiesCount} planned
                </div>
              </div>

              <p>You can view and manage your itinerary by logging into your account.</p>
              <p>Happy travels! ✈️</p>
            </div>
            <div class="footer">
              <p>This is an automated email from TMTC Travel Itinerary API</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hi ${userName},
        
        Great news! Your travel itinerary has been created successfully.
        
        Itinerary Details:
        - Title: ${itinerary.title}
        - Destination: ${itinerary.destination}
        - Start Date: ${startDate}
        - End Date: ${endDate}
        - Activities: ${activitiesCount} planned
        
        You can view and manage your itinerary by logging into your account.
        
        Happy travels!
        
        ---
        This is an automated email from TMTC Travel Itinerary API
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Itinerary creation email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending itinerary creation email:', error.message);
    // Don't throw error - email failure shouldn't break the request
    return false;
  }
};

// Initialize email on module load (if enabled)
if (process.env.EMAIL_ENABLED === 'true') {
  initEmail();
}

module.exports = {
  initEmail,
  sendItineraryCreatedEmail
};

