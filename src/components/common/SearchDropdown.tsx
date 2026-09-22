import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchResultItem } from '../../services/searchService';
import { formatDate } from '../../utils';

interface SearchDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  results: SearchResultItem[];
  query: string;
  totalCount: number;
  isLoading: boolean;
}

/**
 * Компонент выпадающего списка с результатами поиска
 */
const SearchDropdown: React.FC<SearchDropdownProps> = ({
                                                         isOpen,
                                                         onClose,
                                                         results,
                                                         query,
                                                         totalCount,
                                                         isLoading
                                                       }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Обработчик клика вне компонента для закрытия дропдауна
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Анимации для дропдауна
  const dropdownVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  // Получение цвета для статуса задачи
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

  // Получение иконки для типа результата
  const getTypeIcon = (type: 'task' | 'project') => {
    if (type === 'task') {
      return (
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
      );
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

  // Получение иконки для приоритета задачи
  const getPriorityIcon = (priority?: string) => {
    if (!priority) return null;

    let color;
    switch (priority) {
      case 'high': color = 'text-red-500'; break;
      case 'medium': color = 'text-yellow-500'; break;
      case 'low': color = 'text-blue-500'; break;
      default: color = 'text-gray-500';
    }

    return (
      <svg className={`w-4 h-4 ${color}`} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
      </svg>
    );
  };

  // Получение текста для пустых результатов поиска
  const getEmptyResultsText = () => {
    if (!query.trim()) {
      return 'Введите запрос для поиска';
    }
    return `По запросу &quot;${query}&quot; ничего не найдено`;
  };

  // Выделение совпадающего текста в результатах поиска
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.trim()})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      // Если часть соответствует запросу (без учета регистра), выделяем ее
      if (part.toLowerCase() === query.toLowerCase()) {
        return <span key={i} className="bg-yellow-200 dark:bg-yellow-900">{part}</span>;
      }
      return part;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border dark:border-gray-700"
          variants={dropdownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          <div className="px-4 py-2 border-b dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Результаты поиска
              </h3>
              {!isLoading && totalCount > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Найдено: {totalCount}
                </span>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              // Индикатор загрузки
              <div className="flex justify-center items-center py-8">
                <svg className="animate-spin h-6 w-6 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : results.length > 0 ? (
              // Результаты поиска
              results.map((result) => (
                <Link
                  key={`${result.type}-${result.id}`}
                  to={result.link}
                  className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={onClose}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      {getTypeIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {highlightText(result.title, query)}
                        </p>
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getStatusColor(result.status, result.type)}`}>
                          {getStatusText(result.status, result.type)}
                        </span>
                      </div>

                      {result.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 line-clamp-2">
                          {result.description.substring(0, 120) + (result.description.length > 120 ? '...' : '')}
                        </p>
                      )}

                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <span className="capitalize mr-2">{result.type === 'task' ? 'Задача' : 'Проект'}</span>

                        {result.type === 'task' && (
                          <>
                            {result.projectTitle && (
                              <span className="mr-2">
                                в проекте &quot;{result.projectTitle}&quot;
                              </span>
                            )}

                            {result.priority && (
                              <span className="flex items-center mr-2">
                                {getPriorityIcon(result.priority)}
                                <span className="ml-1">
                                  {result.priority === 'high' ? 'Высокий' :
                                    result.priority === 'medium' ? 'Средний' : 'Низкий'}
                                </span>
                              </span>
                            )}

                            {result.dueDate && (
                              <span>
                                Срок: {formatDate(result.dueDate, 'short')}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              // Нет результатов
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <p className="text-sm">{getEmptyResultsText()}</p>
              </div>
            )}
          </div>

          {results.length > 0 && totalCount > results.length && (
            <div className="px-4 py-2 border-t dark:border-gray-700">
              <Link
                to={`/search?q=${encodeURIComponent(query)}`}
                className="w-full block text-center text-xs text-primary hover:text-primary-dark font-medium"
                onClick={onClose}
              >
                Показать все результаты ({totalCount})
              </Link>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchDropdown;