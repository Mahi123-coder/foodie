import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const adminMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required'
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded.id) {
      return res.status(401).json({
        message: 'Invalid token'
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: 'User not found'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'Admin access required'
      });
    }

    req.user = user;

    next();

  } catch (error) {
    console.error(
      'ADMIN AUTH ERROR:',
      error.message
    );

    return res.status(401).json({
      message: 'Invalid or expired token'
    });
  }
};

export default adminMiddleware;