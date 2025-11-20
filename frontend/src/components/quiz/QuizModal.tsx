import React, { useState, useRef } from 'react';
import {
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpTrayIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import type { Quiz, QuizAnswer, QuizResult, QuizQuestion } from '../../services/quizService';
import { evaluateQuiz } from '../../services/quizService';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz: Quiz;
  onQuizComplete: (result: QuizResult) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  quiz,
  onQuizComplete
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(quiz.timeLimit ? quiz.timeLimit * 60 : null); // seconds
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer effect
  React.useEffect(() => {
    if (!isOpen || !timeRemaining || result) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Time's up - auto submit
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeRemaining, result]);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const currentAnswer = answers.find(a => a.questionId === currentQuestion?.id);

  const handleMCQAnswer = (optionId: string, isMultiple: boolean) => {
    if (!currentQuestion) return;

    const existingAnswer = answers.find(a => a.questionId === currentQuestion.id);
    
    if (isMultiple) {
      // Multiple selection
      const currentSelected = existingAnswer?.selectedOptionIds || [];
      const newSelected = currentSelected.includes(optionId)
        ? currentSelected.filter(id => id !== optionId)
        : [...currentSelected, optionId];

      setAnswers(prev => [
        ...prev.filter(a => a.questionId !== currentQuestion.id),
        {
          questionId: currentQuestion.id,
          selectedOptionIds: newSelected
        }
      ]);
    } else {
      // Single selection
      setAnswers(prev => [
        ...prev.filter(a => a.questionId !== currentQuestion.id),
        {
          questionId: currentQuestion.id,
          selectedOptionIds: [optionId]
        }
      ]);
    }
  };

  const handleTextAnswer = (text: string) => {
    if (!currentQuestion) return;

    setAnswers(prev => [
      ...prev.filter(a => a.questionId !== currentQuestion.id),
      {
        questionId: currentQuestion.id,
        textAnswer: text,
        uploadedFile: currentAnswer?.uploadedFile
      }
    ]);
  };

  const handleFileUpload = (file: File) => {
    if (!currentQuestion) return;

    setAnswers(prev => [
      ...prev.filter(a => a.questionId !== currentQuestion.id),
      {
        questionId: currentQuestion.id,
        textAnswer: currentAnswer?.textAnswer,
        uploadedFile: file
      }
    ]);
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    
    try {
      const quizResult = await evaluateQuiz(quiz, answers);
      setResult(quizResult);
    } catch (error) {
      console.error('Error evaluating quiz:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (result) {
      onQuizComplete(result);
      onClose();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  // Show results screen
  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <AcademicCapIcon className="h-8 w-8 text-purple-500" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Quiz Results
              </h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Score Card */}
            <div className={`p-6 rounded-lg text-center ${
              result.passed
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
            }`}>
              <div className="flex items-center justify-center gap-3 mb-4">
                {result.passed ? (
                  <CheckCircleIcon className="h-12 w-12 text-green-500" />
                ) : (
                  <XCircleIcon className="h-12 w-12 text-red-500" />
                )}
                <div>
                  <h3 className={`text-4xl font-bold ${
                    result.passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                  }`}>
                    {result.score}%
                  </h3>
                  <p className={`text-sm ${
                    result.passed ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                  }`}>
                    {result.earnedPoints} / {result.totalPoints} points
                  </p>
                </div>
              </div>
              <p className={`text-lg font-semibold ${
                result.passed ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
              }`}>
                {result.passed 
                  ? '🎉 Congratulations! You passed the quiz!' 
                  : '❌ You need at least 70% to pass. Try again!'}
              </p>
            </div>

            {/* Detailed Feedback */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-white text-lg">
                Question-by-Question Feedback:
              </h4>
              
              {result.feedback.map((feedback, index) => {
                const question = quiz.questions.find(q => q.id === feedback.questionId);
                if (!question) return null;

                return (
                  <div
                    key={feedback.questionId}
                    className={`p-4 rounded-lg border ${
                      feedback.correct
                        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {feedback.correct ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0 mt-1" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white mb-2">
                          Q{index + 1}: {question.question}
                        </p>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">Your answer:</span> {feedback.userAnswer}
                          </p>
                          {!feedback.correct && (
                            <p className="text-gray-700 dark:text-gray-300">
                              <span className="font-semibold">Correct answer:</span> {feedback.correctAnswer}
                            </p>
                          )}
                          <p className="text-gray-600 dark:text-gray-400 italic">
                            {feedback.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleFinish}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                result.passed
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              {result.passed ? 'Complete Task' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show quiz questions
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-3">
              <AcademicCapIcon className="h-8 w-8 text-purple-500" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {quiz.title}
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {quiz.description}
            </p>
          </div>
          {timeRemaining !== null && (
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <ClockIcon className="h-5 w-5 text-purple-500" />
              <span className={`font-mono font-semibold ${
                timeRemaining < 60 ? 'text-red-500' : 'text-purple-700 dark:text-purple-400'
              }`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
            <span>{Math.round(((currentQuestionIndex + 1) / quiz.questions.length) * 100)}% Complete</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Content */}
        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-start gap-3 mb-4">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full flex items-center justify-center font-semibold">
                {currentQuestionIndex + 1}
              </span>
              <div className="flex-1">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {currentQuestion.question}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {currentQuestion.points} points
                  {currentQuestion.type === 'mcq-multiple' && ' • Multiple answers allowed'}
                </p>
              </div>
            </div>

            {/* MCQ Options */}
            {(currentQuestion.type === 'mcq-single' || currentQuestion.type === 'mcq-multiple') && (
              <div className="space-y-2 ml-11">
                {currentQuestion.options?.map(option => {
                  const isSelected = currentAnswer?.selectedOptionIds?.includes(option.id);
                  
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleMCQAnswer(option.id, currentQuestion.type === 'mcq-multiple')}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="text-gray-900 dark:text-white">{option.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Descriptive Answer */}
            {currentQuestion.type === 'descriptive' && (
              <div className="space-y-4 ml-11">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type your answer:
                  </label>
                  <textarea
                    value={currentAnswer?.textAnswer || ''}
                    onChange={(e) => handleTextAnswer(e.target.value)}
                    placeholder="Write your answer here..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    rows={6}
                  />
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">OR</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <ArrowUpTrayIcon className="h-5 w-5" />
                    Upload handwritten answer
                  </button>
                  {currentAnswer?.uploadedFile && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      ✓ File uploaded: {currentAnswer.uploadedFile.name}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>

          <div className="flex gap-2">
            {quiz.questions.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentQuestionIndex
                    ? 'bg-purple-500 w-4'
                    : answers.find(a => a.questionId === quiz.questions[index].id)
                    ? 'bg-green-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {currentQuestionIndex === quiz.questions.length - 1 ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
