const express = require('express');
const { app, User, Article, Category, Comment, Media, authenticateToken, checkRole, upload } = require('./server');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';


app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Пользователь с таким email или именем уже существует' 
      });
    }
    
    const user = new User({
      username,
      email,
      password, 
      firstName,
      lastName,
      role: 'user'
    });
    
    await user.save();
    
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(201).json({
      message: 'Пользователь успешно зарегистрирован',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).json({ message: 'Ошибка сервера при регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(200).json({
      message: 'Успешный вход',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Ошибка при входе:', error);
    res.status(500).json({ message: 'Ошибка сервера при входе' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    console.error('Ошибка при получении данных пользователя:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, bio } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (bio) user.bio = bio;
    
    await user.save();
    
    res.status(200).json({
      message: 'Профиль успешно обновлен',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        bio: user.bio,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    res.status(500).json({ message: 'Ошибка сервера при обновлении профиля' });
  }
});

app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Неверный текущий пароль' });
    }
    
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    console.error('Ошибка при изменении пароля:', error);
    res.status(500).json({ message: 'Ошибка сервера при изменении пароля' });
  }
});

app.post('/api/auth/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    
    if (user.avatar) {
      const oldAvatarPath = path.join(__dirname, user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }
    
    user.avatar = `/uploads/${req.file.filename}`;
    await user.save();
    
    res.status(200).json({
      message: 'Аватар успешно обновлен',
      avatar: user.avatar
    });
  } catch (error) {
    console.error('Ошибка при загрузке аватара:', error);
    res.status(500).json({ message: 'Ошибка сервера при загрузке аватара' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find({ active: true })
      .populate('parentCategory', 'name slug');
    
    res.status(200).json(categories);
  } catch (error) {
    console.error('Ошибка при получении категорий:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении категорий' });
  }
});

app.get('/api/categories/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, active: true })
      .populate('parentCategory', 'name slug');
    
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    
    res.status(200).json(category);
  } catch (error) {
    console.error('Ошибка при получении категории:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении категории' });
  }
});

app.post('/api/categories', authenticateToken, checkRole(['admin', 'editor']), async (req, res) => {
  try {
    const { name, slug, description, parentCategory, image } = req.body;
    
    const existingCategory = await Category.findOne({ slug });
    
    if (existingCategory) {
      return res.status(400).json({ message: 'Категория с таким slug уже существует' });
    }
    
    const category = new Category({
      name,
      slug,
      description,
      parentCategory,
      image
    });
    
    await category.save();
    
    res.status(201).json({
      message: 'Категория успешно создана',
      category
    });
  } catch (error) {
    console.error('Ошибка при создании категории:', error);
    res.status(500).json({ message: 'Ошибка сервера при создании категории' });
  }
});

app.put('/api/categories/:id', authenticateToken, checkRole(['admin', 'editor']), async (req, res) => {
  try {
    const { name, description, parentCategory, image, active } = req.body;
    
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (parentCategory !== undefined) category.parentCategory = parentCategory;
    if (image !== undefined) category.image = image;
    if (active !== undefined) category.active = active;
    
    category.updatedAt = new Date();
    await category.save();
    
    res.status(200).json({
      message: 'Категория успешно обновлена',
      category
    });
  } catch (error) {
    console.error('Ошибка при обновлении категории:', error);
    res.status(500).json({ message: 'Ошибка сервера при обновлении категории' });
  }
});

app.delete('/api/categories/:id', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Категория не найдена' });
    }
    
    const articlesWithCategory = await Article.countDocuments({ categories: req.params.id });
    
    if (articlesWithCategory > 0) {
      category.active = false;
      category.updatedAt = new Date();
      await category.save();
      
      return res.status(200).json({
        message: 'Категория деактивирована, так как она используется в статьях'
      });
    }
    
    await Category.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      message: 'Категория успешно удалена'
    });
  } catch (error) {
    console.error('Ошибка при удалении категории:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении категории' });
  }
});

module.exports = app;
