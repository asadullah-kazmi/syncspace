import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Not authorized. Please login.',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'User not found',
      });
      return;
    }

    (req as AuthRequest).user = {
      id: user._id.toString(),
      email: user.email,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
    });
  }
};
