import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import validator from 'validator';
import User from '../models/user.model';

const generateToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
};

export const register = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid email format',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 8 characters long',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'Email already registered',
      });
    }

    const user = await User.create({ email, password });

    const token = generateToken(user._id.toString());

    return res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Registration failed',
    });
  }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(user._id.toString());

    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Login failed',
    });
  }
};
