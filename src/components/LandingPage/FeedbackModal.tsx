import React, { useState } from 'react';
import { X, MessageSquare, CheckCircle2, Star, Send, Loader2, AlertCircle } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState<number>(5);
  const [category, setCategory] = useState<string>('Features');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg('Please enter your feedback before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          category,
          message: message.trim(),
          email: email.trim() || undefined,
          name: name.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.error || `Server responded with error status ${response.status}`);
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage('');
        setName('');
        setEmail('');
        onClose();
      }, 2200);
    } catch (err: any) {
      console.error('[Feedback Submission Failure]:', err);
      setErrorMsg(err.message || 'Unable to submit feedback. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative text-left max-h-[92vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          id="feedback-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Thank you for your feedback!</h3>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto leading-relaxed">
              Your feedback has been saved to the backend and dispatched to our engineering &amp; operations teams.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 pr-8">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Send Feedback to Frostly</h3>
                <p className="text-xs text-slate-500">Connected directly to Frostly engineering</p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Satisfaction Rating */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Overall Impression
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    id={`feedback-star-${star}`}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star className={`w-6 h-6 ${star <= rating ? 'fill-amber-400' : 'text-slate-200'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Category selection */}
            <div>
              <label htmlFor="feedback-topic-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Feedback Topic
              </label>
              <select
                id="feedback-topic-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 cursor-pointer"
              >
                <option value="Features">Feature Request (Weighing / HACCP / POS)</option>
                <option value="Usability">Usability &amp; Design Feedback</option>
                <option value="Hardware">Scale &amp; Label Printer Integration</option>
                <option value="Pricing">Pricing &amp; Enterprise Licences</option>
                <option value="Bug">Report an Issue or Bug</option>
                <option value="Other">Other Operational Feedback</option>
              </select>
            </div>

            {/* User Name & Email (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="feedback-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="feedback-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 bg-white"
                />
              </div>
              <div>
                <label htmlFor="feedback-email-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="feedback-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="For follow-up"
                  className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400 bg-white"
                />
              </div>
            </div>

            {/* Message Area */}
            <div>
              <label htmlFor="feedback-message-textarea" className="block text-xs font-semibold text-slate-700 mb-1">
                Your Feedback <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="feedback-message-textarea"
                required
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your thoughts, workflow suggestions, or cold-chain requirements..."
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="feedback-cancel-btn"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="feedback-submit-btn"
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
