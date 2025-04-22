const { app, User, Article, Category, Comment, Media, authenticateToken, checkRole, upload } = require('./server');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');


app.get('/api/articles', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      author,
      tag,
      status = 'published',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const filter = { status: status };
    
    // Добавление фильтров, если они указаны
    if (category) {
      filter.categories = mongoose.Types.ObjectId(category);
    }
    
    if (author) {
      filter.author = mongoose.Types.ObjectId(author);
    }
    
    if (tag) {
      filter.tags = { $in: [tag] };
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const total = await Article.countDocuments(filter);
    
    const articles = await Article.find(filter)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('author', 'username firstName lastName avatar')
      .populate('categories', 'name slug');
    
    res.status(200).json({
      articles,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalArticles: total
    });

app.delete('/api/articles/:id', authenticateToken, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    if (article.author.toString() !== req.user.id && 
        !['admin', 'editor'].includes(req.user.role)) {
      return res.status(403).json({ message: 'У вас нет прав на удаление этой статьи' });
    }
    
    await Comment.deleteMany({ article: req.params.id });
    
    await Article.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      message: 'Статья и связанные комментарии успешно удалены'
    });
  } catch (error) {
    console.error('Ошибка при удалении статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении статьи' });
  }
});

app.get('/api/articles/:articleId/comments', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const article = await Article.findById(req.params.articleId);
    
    if (!article) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    const total = await Comment.countDocuments({ 
      article: req.params.articleId,
      approved: true,
      parentComment: null 
    });
    
    const comments = await Comment.find({ 
      article: req.params.articleId,
      approved: true,
      parentComment: null 
    })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('author', 'username firstName lastName avatar');
    
    const commentsWithReplies = await Promise.all(comments.map(async (comment) => {
      const replies = await Comment.find({
        article: req.params.articleId,
        approved: true,
        parentComment: comment._id
      })
        .sort({ createdAt: 1 })
        .populate('author', 'username firstName lastName avatar');
      
      return {
        ...comment.toObject(),
        replies
      };
    }));
    
    res.status(200).json({
      comments: commentsWithReplies,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalComments: total
    });
  } catch (error) {
    console.error('Ошибка при получении комментариев:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении комментариев' });
  }
});

app.post('/api/articles/:articleId/comments', authenticateToken, async (req, res) => {
  try {
    const { content, parentComment } = req.body;
    
    // Проверка существования статьи
    const article = await Article.findById(req.params.articleId);
    
    if (!article) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    if (parentComment) {
      const parentCommentExists = await Comment.findOne({ 
        _id: parentComment,
        article: req.params.articleId
      });
      
      if (!parentCommentExists) {
        return res.status(404).json({ message: 'Родительский комментарий не найден' });
      }
    }
    
    const comment = new Comment({
      article: req.params.articleId,
      author: req.user.id,
      content,
      parentComment,
      approved: ['admin', 'editor'].includes(req.user.role)
    });
    
    await comment.save();
    
    res.status(201).json({
      message: ['admin', 'editor'].includes(req.user.role) 
        ? 'Комментарий успешно добавлен' 
        : 'Комментарий отправлен на модерацию',
      comment
    });
  } catch (error) {
    console.error('Ошибка при добавлении комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера при добавлении комментария' });
  }
});

app.put('/api/comments/:id/moderate', authenticateToken, checkRole(['admin', 'editor']), async (req, res) => {
  try {
    const { approved } = req.body;
    
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }
    
    comment.approved = approved;
    comment.updatedAt = new Date();
    await comment.save();
    
    res.status(200).json({
      message: approved ? 'Комментарий одобрен' : 'Комментарий отклонен',
      comment
    });
  } catch (error) {
    console.error('Ошибка при модерации комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера при модерации комментария' });
  }
});

app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment) {
      return res.status(404).json({ message: 'Комментарий не найден' });
    }
    
    if (comment.author.toString() !== req.user.id && 
        !['admin', 'editor'].includes(req.user.role)) {
      return res.status(403).json({ message: 'У вас нет прав на удаление этого комментария' });
    }
    
    await Comment.findByIdAndDelete(req.params.id);
    
    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: req.params.id });
    }
    
    res.status(200).json({
      message: 'Комментарий успешно удален'
    });
  } catch (error) {
    console.error('Ошибка при удалении комментария:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении комментария' });
  }
});


app.post('/api/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' });
    }
    
    const media = new Media({
      name: req.body.name || req.file.originalname,
      fileName: req.file.filename,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id
    });
    
    await media.save();
    
    res.status(201).json({
      message: 'Файл успешно загружен',
      media
    });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    res.status(500).json({ message: 'Ошибка сервера при загрузке файла' });
  }
});

app.get('/api/media', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const filter = ['admin', 'editor'].includes(req.user.role) 
      ? {} 
      : { uploadedBy: req.user.id };
    
    const total = await Media.countDocuments(filter);
    
    const media = await Media.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('uploadedBy', 'username');
    
    res.status(200).json({
      media,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalMedia: total
    });
  } catch (error) {
    console.error('Ошибка при получении медиафайлов:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении медиафайлов' });
  }
});

app.delete('/api/media/:id', authenticateToken, async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    
    if (!media) {
      return res.status(404).json({ message: 'Файл не найден' });
    }
    
    if (media.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'У вас нет прав на удаление этого файла' });
    }
    
    const filePath = path.join(__dirname, media.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Удаление записи о файле из базы данных
    await Media.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      message: 'Файл успешно удален'
    });
  } catch (error) {
    console.error('Ошибка при удалении файла:', error);
    res.status(500).json({ message: 'Ошибка сервера при удалении файла' });
  }
});
  } catch (error) {
    console.error('Ошибка при получении статей:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении статей' });
  }
});

app.get('/api/articles/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug })
      .populate('author', 'username firstName lastName avatar bio')
      .populate('categories', 'name slug');
    
    if (!article) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    article.viewCount += 1;
    await article.save();
    
    res.status(200).json(article);
  } catch (error) {
    console.error('Ошибка при получении статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера при получении статьи' });
  }
});

app.post('/api/articles', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      slug,
      content,
      summary,
      categories,
      tags,
      featuredImage,
      gallery,
      status,
      isBreakingNews,
      isFeatured,
      publishDate
    } = req.body;
    
    const existingArticle = await Article.findOne({ slug });
    
    if (existingArticle) {
      return res.status(400).json({ message: 'Статья с таким slug уже существует' });
    }
    
    const article = new Article({
      title,
      slug,
      content,
      summary,
      author: req.user.id,
      categories,
      tags,
      featuredImage,
      gallery,
      status: req.user.role === 'user' ? 'draft' : (status || 'draft'),
      isBreakingNews: req.user.role === 'user' ? false : (isBreakingNews || false),
      isFeatured: req.user.role === 'user' ? false : (isFeatured || false),
      publishDate: publishDate || new Date()
    });
    
    await article.save();
    
    res.status(201).json({
      message: 'Статья успешно создана',
      article
    });
  } catch (error) {
    console.error('Ошибка при создании статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера при создании статьи' });
  }
});

app.put('/api/articles/:id', authenticateToken, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'Статья не найдена' });
    }
    
    if (article.author.toString() !== req.user.id && 
        !['admin', 'editor'].includes(req.user.role)) {
      return res.status(403).json({ message: 'У вас нет прав на редактирование этой статьи' });
    }
    
    const {
      title,
      content,
      summary,
      categories,
      tags,
      featuredImage,
      gallery,
      status,
      isBreakingNews,
      isFeatured,
      publishDate
    } = req.body;
    
    if (title) article.title = title;
    if (content) article.content = content;
    if (summary !== undefined) article.summary = summary;
    if (categories) article.categories = categories;
    if (tags) article.tags = tags;
    if (featuredImage !== undefined) article.featuredImage = featuredImage;
    if (gallery) article.gallery = gallery;
    
    if (req.user.role === 'user') {
      if (status) {
        if (status !== 'draft' && article.status === 'draft') {
          article.status = 'draft'; 
        } else if (article.status === 'published') {
          article.status = status;
        }
      }
    } else {
      if (status) article.status = status;
      if (isBreakingNews !== undefined) article.isBreakingNews = isBreakingNews;
      if (isFeatured !== undefined) article.isFeatured = isFeatured;
      if (publishDate) article.publishDate = publishDate;
    }
    
    article.updatedAt = new Date();
    await article.save();
    
    res.status(200).json({
      message: 'Статья успешно обновлена',
      article
    });
  } catch (error) {
    console.error('Ошибка при обновлении статьи:', error);
    res.status(500).json({ message: 'Ошибка сервера при обновлении статьи' });
  }
});
