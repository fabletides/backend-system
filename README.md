News Portal Backend System
A full-featured server-side application for managing a news portal with support for users, articles, categories, comments, and media files.
Table of Contents

Overview
Features
Technologies
Project Structure
Installation and Setup
API
Data Models
Role System
Usage Examples

Overview
This server application is a REST API for a news portal. The system allows you to manage publications, users, content categories, and media files, and includes a commenting system with moderation.
Features

Authentication and Authorization

User registration and login
JWT tokens for security
Role-based access control (user, editor, admin)


Article Management

Create, edit, publish, and delete articles
Categorization and tagging
Support for drafts and different publication statuses
View counter and statistics


Category Management

Tree structure for categories
SEO-friendly slug URLs


Commenting System

Threaded comments with replies
Comment moderation
User comment management


Media Files

Upload and storage of images and other files
Management of uploaded files



Technologies

Node.js - JavaScript runtime
Express - Web framework for Node.js
MongoDB - NoSQL database
Mongoose - MongoDB ODM
JSON Web Tokens (JWT) - Authentication system
Bcrypt - Password hashing
Multer - File upload handling

Project Structure
The project is organized in a compact structure with 4 main files:

server.js - Main server file containing Express configuration and Mongoose models
routes.js - API routes for users and categories
api-controllers.js - API controllers for articles, comments, and media files
frontend-utils.js - Frontend utilities and API call examples

Installation and Setup
Prerequisites

Node.js (version 14.x or higher)
MongoDB (version 4.x or higher)

Installation Steps

Clone the repository
bashgit clone https://github.com/yourusername/news-portal-backend.git
cd news-portal-backend

Install dependencies
bashnpm install

Create a .env file in the project root
PORT=5000
MONGO_URI=mongodb://localhost:27017/news_portal
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

Start the server
bash# For development (with nodemon)
npm run dev

# For production
npm start


API
Authentication

POST /api/auth/register - Register a new user
POST /api/auth/login - User login
GET /api/auth/me - Get current user information
PUT /api/auth/profile - Update user profile
PUT /api/auth/change-password - Change password
POST /api/auth/avatar - Upload user avatar

Categories

GET /api/categories - Get all categories
GET /api/categories/ - Get category by slug
POST /api/categories - Create a new category (editor, admin)
PUT /api/categories/ - Update a category (editor, admin)
DELETE /api/categories/ - Delete a category (admin)

Articles

GET /api/articles - Get all articles with pagination and filtering
GET /api/articles/ - Get article by slug
POST /api/articles - Create a new article (authenticated users)
PUT /api/articles/ - Update an article (author, editor, admin)
DELETE /api/articles/ - Delete an article (author, editor, admin)

Comments

GET /api/articles//comments - Get comments for an article
POST /api/articles//comments - Add a comment to an article
PUT /api/comments//moderate - Moderate a comment (editor, admin)
DELETE /api/comments/ - Delete a comment (author, editor, admin)

Media Files

POST /api/media/upload - Upload a media file
GET /api/media - Get a list of all user's media files
DELETE /api/media/ - Delete a media file

Data Models
User
javascript{
  username: String,          // Unique username
  email: String,             // User email
  password: String,          // Hashed password
  firstName: String,         // First name
  lastName: String,          // Last name
  role: String,              // Role: user, editor, admin
  avatar: String,            // Path to avatar
  bio: String,               // User information
  active: Boolean,           // Whether the account is active
  createdAt: Date,           // Creation date
  lastLogin: Date            // Last login date
}
Category
javascript{
  name: String,              // Category name
  slug: String,              // URL-friendly identifier
  description: String,       // Description
  parentCategory: ObjectId,  // Parent category
  image: String,             // Category image
  active: Boolean,           // Whether the category is active
  createdAt: Date,           // Creation date
  updatedAt: Date            // Update date
}
Article
javascript{
  title: String,             // Article title
  slug: String,              // URL-friendly identifier
  content: String,           // Article content
  summary: String,           // Brief description
  author: ObjectId,          // Article author
  categories: [ObjectId],    // Array of categories
  tags: [String],            // Array of tags
  featuredImage: String,     // Main image
  gallery: [String],         // Image gallery
  status: String,            // Status: draft, published, archived
  viewCount: Number,         // View counter
  isBreakingNews: Boolean,   // Breaking news flag
  isFeatured: Boolean,       // Featured article flag
  publishDate: Date,         // Publication date
  createdAt: Date,           // Creation date
  updatedAt: Date            // Update date
}
Comment
javascript{
  article: ObjectId,         // Article the comment belongs to
  author: ObjectId,          // Comment author
  content: String,           // Comment content
  parentComment: ObjectId,   // Parent comment (for replies)
  approved: Boolean,         // Whether the comment is approved
  createdAt: Date,           // Creation date
  updatedAt: Date            // Update date
}
Media
javascript{
  name: String,              // File name
  fileName: String,          // System file name
  fileType: String,          // File MIME type
  fileSize: Number,          // File size in bytes
  url: String,               // URL for file access
  uploadedBy: ObjectId,      // Who uploaded the file
  createdAt: Date            // Upload date
}
Role System
The system has three access levels:

User

Can read public content
Create and edit their own articles (in draft status)
Leave comments (requiring moderation)
Manage their own media files


Editor

All user capabilities
Create and edit categories
Publish and edit any articles
Moderate comments
Access to all media files


Admin

All editor capabilities
Delete categories
Manage users
Full system access



Usage Examples
User Registration
javascriptconst registerUser = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'user1',
        email: 'user1@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe'
      })
    });
    
    const data = await response.json();
    console.log('Registration successful:', data);
    localStorage.setItem('authToken', data.token);
    
    return data;
  } catch (error) {
    console.error('Registration error:', error);
  }
};
Creating an Article
javascriptconst createArticle = async () => {
  try {
    const token = localStorage.getItem('authToken');
    
    const response = await fetch('http://localhost:5000/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'New Article Title',
        slug: 'new-article-title',
        content: 'New article content...',
        summary: 'Brief article description',
        categories: ['6123456789abcdef12345678'],
        tags: ['news', 'technology'],
        status: 'draft'
      })
    });
    
    const data = await response.json();
    console.log('Article created:', data);
    
    return data;
  } catch (error) {
    console.error('Error creating article:', error);
  }
};
Uploading a Media File
javascriptconst uploadMedia = async (file) => {
  try {
    const token = localStorage.getItem('authToken');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', 'My Image');
    
    const response = await fetch('http://localhost:5000/api/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    console.log('File uploaded:', data);
    
    return data;
  } catch (error) {
    console.error('Error uploading file:', error);
  }
};
