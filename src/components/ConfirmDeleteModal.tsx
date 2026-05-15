import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  title: string;
  itemName: string;
  usageInfo?: string;
  onDelete: () => void;
  onArchive?: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteModal({ title, itemName, usageInfo, onDelete, onArchive, onCancel }: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete <span className="font-semibold">{itemName}</span>?
              </p>
              {usageInfo && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 font-medium">
                  {usageInfo}
                </p>
              )}
              {!usageInfo && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This action cannot be undone.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {usageInfo && onArchive ? (
              <>
                <button
                  onClick={onArchive}
                  className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Archive Instead
                </button>
                <button
                  onClick={onCancel}
                  className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
