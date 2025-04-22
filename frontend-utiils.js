const API_BASE_URL = 'http://localhost:5000/api';
class AuthService {
  static setToken(token) {
    localStorage.setItem('authToken', token);
  }

  static getToken() {
    return localStorage.getItem('authToken');
  }

  static removeToken() {
    localStorage.removeItem('authToken');
  }

  static isAuthenticated() {
    return !!this.getToken();
  }

  static decodeToken() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Ошибка декодирования токена:', e);
      return null;
    }
  }

  static getUserRole() {
    const decoded = this.decodeToken();
    return decoded ? decoded.role : null;
  }

  static hasRole(roles) {
    const userRole = this.getUserRole();
    return userRole && roles.includes(userRole);
  }
}

class ApiService {
  static async fetchWithAuth(endpoint, options = {}) {
    const token = AuthService.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        AuthService.removeToken();
        window.location.href = '/login';
        throw new Error('Необходима авторизация');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Произошла ошибка при запросе к API');
      }

      if (options.method === 'HEAD') {
        return response;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      console.error(`Ошибка запроса к API (${endpoint}):`, error);
      throw error;
    }
  }

  static async login(email, password) {
    const data = await this.fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.token) {
      AuthService.setToken(data.token);
    }

    return data;
  }

  static async register(userData) {
    const data = await this.fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    if (data.token) {
      AuthService.setToken(data.token);
    }

    return data;
  }

  static async getProfile() {
    return await this.fetchWithAuth('/auth/me');
  }

  static async updateProfile(profileData) {
    return await this.fetchWithAuth('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  static async changePassword(currentPassword, newPassword) {
    return await this.fetchWithAuth('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  static async getCategories() {
    return await this.fetchWithAuth('/categories');
  }

  static async getCategoryBySlug(slug) {
    return await this.fetchWithAuth(`/categories/${slug}`);
  }

  static async createCategory(categoryData) {
    return await this.fetchWithAuth('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData)
    });
  }

  static async updateCategory(id, categoryData) {
    return await this.fetchWithAuth(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData)
    });
  }

  static async deleteCategory(id) {
    return await this.fetchWithAuth(`/categories/${id}`, {
      method: 'DELETE'
    });
  }

  static async getArticles(params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = `/articles${queryString ? `?${queryString}` : ''}`;
    
    return await this.fetchWithAuth(endpoint);
  }

  static async getArticleBySlug(slug) {
    return await this.fetchWithAuth(`/articles/${slug}`);
  }

  static async createArticle(articleData) {
    return await this.fetchWithAuth('/articles', {
      method: 'POST',
      body: JSON.stringify(articleData)
    });
  }

  static async updateArticle(id, articleData) {
    return await this.fetchWithAuth(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(articleData)
    });
  }

  static async deleteArticle(id) {
    return await this.fetchWithAuth(`/articles/${id}`, {
      method: 'DELETE'
    });
  }

  static async getComments(articleId, params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = `/articles/${articleId}/comments${queryString ? `?${queryString}` : ''}`;
    
    return await this.fetchWithAuth(endpoint);
  }

  static async addComment(articleId, commentData) {
    return await this.fetchWithAuth(`/articles/${articleId}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData)
    });
  }

  static async moderateComment(id, approved) {
    return await this.fetchWithAuth(`/comments/${id}/moderate`, {
      method: 'PUT',
      body: JSON.stringify({ approved })
    });
  }

  static async deleteComment(id) {
    return await this.fetchWithAuth(`/comments/${id}`, {
      method: 'DELETE'
    });
  }

  static async uploadMedia(file, name) {
    const formData = new FormData();
    formData.append('file', file);
    if (name) {
      formData.append('name', name);
    }

    const token = AuthService.getToken();
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Произошла ошибка при загрузке файла');
    }

    return await response.json();
  }

  static async getMedia(params = {}) {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    
    const queryString = queryParams.toString();
    const endpoint = `/media${queryString ? `?${queryString}` : ''}`;
    
    return await this.fetchWithAuth(endpoint);
  }

  static async deleteMedia(id) {
    return await this.fetchWithAuth(`/media/${id}`, {
      method: 'DELETE'
    });
  }
}

const ApiExamples = {
  async registerExample() {
    try {
      const userData = {
        username: 'user1',
        email: 'user1@example.com',
        password: 'password123',
        firstName: 'Иван',
        lastName: 'Иванов'
      };
      
      const result = await ApiService.register(userData);
      console.log('Регистрация успешна:', result);
      
      return result;
    } catch (error) {
      console.error('Ошибка при регистрации:', error);
      throw error;
    }
  },
  
  async loginExample() {
    try {
      const result = await ApiService.login('user1@example.com', 'password123');
      console.log('Вход выполнен успешно:', result);
      
      return result;
    } catch (error) {
      console.error('Ошибка при входе:', error);
      throw error;
    }
  },
  
  async getUserProfileExample() {
    try {
      const profile = await ApiService.getProfile();
      console.log('Профиль пользователя:', profile);
      
      return profile;
    } catch (error) {
      console.error('Ошибка при получении профиля:', error);
      throw error;
    }
  },
  
  async createArticleExample() {
    try {
      const articleData = {
        title: 'Заголовок новой статьи',
        slug: 'zagolovok-novoy-stati',
        content: 'Содержимое новой статьи...',
        summary: 'Краткое описание статьи',
        categories: ['6123456789abcdef12345678'], 
        tags: ['новости', 'технологии'],
        status: 'draft'
      };
      
      const result = await ApiService.createArticle(articleData);
      console.log('Статья создана:', result);
      
      return result;
    } catch (error) {
      console.error('Ошибка при создании статьи:', error);
      throw error;
    }
  },
  
  async getArticlesExample() {
    try {
      const params = {
        page: 1,
        limit: 10,
        category: '6123456789abcdef12345678', 
        status: 'published',
        sortBy: 'publishDate',
        sortOrder: 'desc'
      };
      
      const articles = await ApiService.getArticles(params);
      console.log('Получен список статей:', articles);
      
      return articles;
    } catch (error) {
      console.error('Ошибка при получении статей:', error);
      throw error;
    }
  },
  
  async uploadMediaExample(file) {
    try {
      const result = await ApiService.uploadMedia(file, 'Название файла');
      console.log('Файл загружен:', result);
      
      return result;
    } catch (error) {
      console.error('Ошибка при загрузке файла:', error);
      throw error;
    }
  }
};

export { AuthService, ApiService, ApiExamples };
