import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { searchService, SearchResultItem } from '../services/searchService';
import { formatDate } from '../utils';

/**
 * Страница с результатами поиска
 */
const SearchPage: React.FC = () => {
  // Получаем параметры поиска из URL
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const query = queryParams.get('q') || '';
  const typeFilter = queryParams.get('type') || 'all';

  // Состояние для результатов поиска
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(query);

  // Выполняем поиск при изменении URL или фильтра
  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) return;

      try {
        setIsLoading(true);
        const { items, totalCount, taskCount, projectCount } = await searchService.search(query, 100);

        // Фильтруем результаты по типу, если выбран фильтр
        let filteredItems = items;
        if (typeFilter === 'tasks') {
          filteredItems = items.filter(item => item.type === 'task');
        } else if (typeFilter === 'projects') {
          filteredItems = items.filter(item => item.type === 'project');
        }

        setResults(filteredItems);
        setTotalCount(totalCount);
        setTaskCount(taskCount);
        setProjectCount(projectCount);
      } catch (error) {
        console.error('Ошибка при выполнении поиска:', error);
        setResults([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [query, typeFilter]);

  // Обработчик отправки формы поиска
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}&type=${typeFilter}`);
    }
  };

  // Обработчик изменения фильтра типа результатов
  const handleTypeFilterChange = (type: string) => {
    navigate(`/search?q=${encodeURIComponent(query)}&type=${type}`);
  };

  // Получение цвета для статуса
  const getStatusColor = (status: string, type: 'task' | 'project'): string => {
    if (type === 'task') {
      switch (status) {
        case 'todo': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        case 'inProgress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        case 'review': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
        case 'done': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      }
    } else {
      switch (status) {
        case 'planning': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'onHold': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
        case 'completed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      }
    }
  };

  // Получение текста для статуса
  const getStatusText = (status: string, type: 'task' | 'project'): string => {
    if (type === 'task') {
      switch (status) {
        case 'todo': return 'К выполнению';
        case 'inProgress': return 'В процессе';
        case 'review': return 'На проверке';
        case 'done': return 'Выполнено';
        default: return status;
      }
    } else {
      switch (status) {
        case 'planning': return 'Планирование';
        case 'active': return 'Активный';
        case 'onHold': return 'На паузе';
        case 'completed': return 'Завершен';
        default: return status;
      }
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Результаты поиска
        </h1>

        {/* Форма поиска */}
        <form onSubmit={handleSearchSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              <input
                type="search"
                className="form-input pl-10"
                placeholder="Поиск задач, проектов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
            >
              Поиск
            </button>
          </div>
        </form>

        {/* Фильтры и статистика */}
        <div className="flex flex-wrap justify-between items-center mb-4">
          <div className="flex gap-2 mb-2 sm:mb-0">
            <button
              className={`px-3 py-1 rounded-md ${
                typeFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => handleTypeFilterChange('all')}
            >
              Все ({totalCount})
            </button>
            <button
              className={`px-3 py-1 rounded-md ${
                typeFilter === 'tasks'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => handleTypeFilterChange('tasks')}
            >
              Задачи ({taskCount})
            </button>
            <button
              className={`px-3 py-1 rounded-md ${
                typeFilter === 'projects'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              onClick={() => handleTypeFilterChange('projects')}
            >
              Проекты ({projectCount})
            </button>
          </div>

          {query && !isLoading && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>
                Найдено {results.length} {results.length === 1 ? 'результат' :
                results.length > 1 && results.length < 5 ? 'результата' : 'результатов'}
                по запросу &quot;{query}&quot;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Результаты поиска */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((result) => (
            <Link
              key={`${result.type}-${result.id}`}
              to={result.link}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start">
                {/* Иконка типа результата */}
                <div className="flex-shrink-0 mr-4">
                  {result.type === 'task' ? (
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-500 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                      </svg>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-500 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Информация о результате */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h2 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                      {result.title}
                    </h2>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(result.status, result.type)}`}>
                      {getStatusText(result.status, result.type)}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full">
                      {result.type === 'task' ? 'Задача' : 'Проект'}
                    </span>
                  </div>

                  {result.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {result.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                    {result.type === 'task' && (
                      <>
                        {result.priority && (
                          <div className="flex items-center">
                            <span className={`w-2 h-2 mr-1 rounded-full ${
                              result.priority === 'high' ? 'bg-red-500' :
                                result.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}></span>
                            <span>
                              {result.priority === 'high' ? 'Высокий приоритет' :
                                result.priority === 'medium' ? 'Средний приоритет' : 'Низкий приоритет'}
                            </span>
                          </div>
                        )}

                        {result.dueDate && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <span>Срок: {formatDate(result.dueDate)}</span>
                          </div>
                        )}

                        {result.projectTitle && (
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                            </svg>
                            <span>Проект: {result.projectTitle}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <h2 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
            {query ? `По запросу &quot;${query}&quot; ничего не найдено` : 'Введите запрос для поиска'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {query ? 'Попробуйте изменить поисковый запрос или параметры фильтрации' :
              'Используйте поиск для нахождения задач и проектов по названию или описанию'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;