const express = require('express');
const router = express.Router();
const authenticate = require('../utils/auth');
const { cacheMiddleware } = require('../utils/cache');
const {
  createItinerary,
  getItineraries,
  getItineraryById,
  updateItinerary,
  deleteItinerary,
  generateShareableLink,
  getSharedItinerary
} = require('../controllers/itineraryController');

/**
 * @swagger
 * /api/itineraries/share/{shareableId}:
 *   get:
 *     summary: Get shared itinerary (public)
 *     tags: [Itineraries]
 *     parameters:
 *       - in: path
 *         name: shareableId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shared itinerary retrieved
 *       404:
 *         description: Itinerary not found
 */
router.get('/share/:shareableId', getSharedItinerary);

// Protected routes
router.use(authenticate);

/**
 * @swagger
 * /api/itineraries:
 *   post:
 *     summary: Create a new itinerary
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - destination
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *               destination:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               activities:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     time:
 *                       type: string
 *                     description:
 *                       type: string
 *                     location:
 *                       type: string
 *     responses:
 *       201:
 *         description: Itinerary created
 */
router.post('/', createItinerary);

/**
 * @swagger
 * /api/itineraries:
 *   get:
 *     summary: Get all itineraries with filtering, pagination, and sorting
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: destination
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *     responses:
 *       200:
 *         description: List of itineraries
 */
router.get('/', getItineraries);

/**
 * @swagger
 * /api/itineraries/{id}:
 *   get:
 *     summary: Get itinerary by ID (cached)
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Itinerary retrieved
 *       404:
 *         description: Itinerary not found
 */
router.get('/:id', cacheMiddleware(300), getItineraryById);

/**
 * @swagger
 * /api/itineraries/{id}:
 *   put:
 *     summary: Update itinerary
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               destination:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               activities:
 *                 type: array
 *     responses:
 *       200:
 *         description: Itinerary updated
 */
router.put('/:id', updateItinerary);

/**
 * @swagger
 * /api/itineraries/{id}:
 *   delete:
 *     summary: Delete itinerary
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Itinerary deleted
 */
router.delete('/:id', deleteItinerary);

/**
 * @swagger
 * /api/itineraries/{id}/share:
 *   post:
 *     summary: Generate shareable link for itinerary
 *     tags: [Itineraries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shareable link generated
 */
router.post('/:id/share', generateShareableLink);

module.exports = router;

