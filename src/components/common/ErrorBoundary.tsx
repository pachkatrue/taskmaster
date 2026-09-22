import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Компонент для обработки ошибок в приложении
 * Предотвращает падение всего приложения при ошибке в дочерних компонентах
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  /**
   * Обновляем состояние, если произошла ошибка
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Логирование ошибок в консоль или сервис мониторинга
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Ошибка в компоненте:', error);
    console.error('Информация об ошибке:', errorInfo);

    // Здесь можно добавить отправку ошибки в сервис мониторинга
    // Например, Sentry, LogRocket и т.д.
  }

  /**
   * Обработчик повторной попытки загрузки компонента
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    // Если произошла ошибка, показываем запасной UI
    if (this.state.hasError) {
      // Если передан пользовательский fallback, используем его
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Иначе показываем стандартный UI ошибки
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
          <div className="text-center max-w-md">
            <svg
              className="w-16 h-16 mb-4 text-red-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>

            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
              Упс! Что-то пошло не так
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Произошла ошибка при загрузке компонента. Попробуйте перезагрузить страницу или вернуться на главную.
            </p>

            <div className="space-x-4">
              <button
                onClick={this.handleReset}
                className="btn-primary"
              >
                Попробовать снова
              </button>

              <Link to="/" className="btn-secondary">
                На главную
              </Link>
            </div>

            {/* Показываем техническую информацию об ошибке в режиме разработки */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
                  Техническая информация:
                </h3>
                <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Если ошибки нет, рендерим дочерние компоненты как обычно
    return this.props.children;
  }
}

export default ErrorBoundary;