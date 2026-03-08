import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FAQs = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How do I create an account on MediConnect?",
      answer:
        "Visit the Sign Up page and enter your email, phone number, and create a password. You'll receive a verification code via email to confirm your identity. Once verified, you can access your patient dashboard and start booking appointments with healthcare providers.",
    },
    {
      question: "What should I do if I forget my password?",
      answer:
        "Click on 'Forgot Password' on the login page. Enter your registered email address, and we'll send you a password reset link. Follow the instructions in the email to create a new password. If you don't receive the email, check your spam folder or contact our support team.",
    },
    {
      question: "How do I find and book an appointment with a doctor?",
      answer:
        "Go to the Doctors page, search by specialization or doctor name, and check their available time slots. Select a suitable appointment time and confirm your booking. You'll receive a confirmation notification, and the doctor will be notified of your appointment request.",
    },
    {
      question: "Can I reschedule or cancel my booked appointment?",
      answer:
        "Yes, you can manage your appointments from your dashboard. Click on the appointment and select 'Reschedule' or 'Cancel'. We recommend canceling at least 24 hours in advance. Changes will be instantly updated in the doctor's calendar and you'll receive a notification.",
    },
    {
      question: "How do I access my medical prescriptions?",
      answer:
        "After a consultation with your doctor, prescriptions will be automatically uploaded to your 'Medical Prescriptions' section. You can view, download in PDF format, and share them directly with pharmacies. All prescriptions are securely stored for future reference.",
    },
    {
      question: "Is my medical data secure and private?",
      answer:
        "Absolutely. All patient data is encrypted using industry-standard SSL/TLS protocols. Your medical records are only accessible to you and authorized healthcare providers. We strictly comply with healthcare data protection regulations and never share your information without consent.",
    },
    {
      question: "How does the medical OCR feature work?",
      answer:
        "Our Medical OCR (Optical Character Recognition) feature allows you to upload images of medical documents, test reports, or prescriptions. The system automatically extracts text and key medical information, organizing it into your medical records for easy access and reference.",
    },
    {
      question: "How do I manage my appointments and health notifications?",
      answer:
        "Access the Notifications section from your dashboard to view appointment reminders, prescription updates, and system alerts. You can manage notification preferences in your account settings. We'll alert you about upcoming appointments, test results, and important health updates.",
    },
    {
      question: "What should I do if I encounter a technical issue?",
      answer:
        "If you experience any technical problems, try refreshing the page or clearing your browser cache. For persistent issues, visit our Contact Us page to report the problem with details about your device and what you were doing. Our technical support team typically responds within 2-4 hours.",
    },
    {
      question: "How can I contact MediConnect support?",
      answer:
        "You can reach our support team through the Contact Us page by selecting your issue type, providing details, and submitting the form. We also provide email support at support@mediconnect.com and respond to all inquiries within 24-48 hours. For urgent matters, call our hotline.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-sky-100 rounded-full p-3">
              <HelpCircle className="h-8 w-8 text-sky-600" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Frequently Asked Questions</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Get answers to common questions about MediConnect services
          </p>
        </div>

        {/* FAQs */}
        <div className="space-y-3 mb-12">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <div className="flex items-center justify-between p-5 gap-4">
                <h3 className="font-semibold text-slate-900 text-base flex-1 text-left">{faq.question}</h3>
                <button
                  className="flex-shrink-0 transition-transform duration-200"
                  aria-label={openIndex === index ? "Collapse answer" : "Expand answer"}
                >
                  {openIndex === index ? (
                    <ChevronUp className="h-5 w-5 text-sky-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>
              </div>
              {openIndex === index && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-100 bg-slate-50">
                  <p className="text-slate-700 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-sky-500 to-cyan-500 rounded-2xl p-8 text-center text-white shadow-lg">
          <h3 className="text-2xl font-bold mb-2">Still have questions?</h3>
          <p className="text-sky-100 mb-6 max-w-xl mx-auto">
            Can't find the answer you're looking for? Our support team is available 24/7 to help.
          </p>
          <button
            onClick={() => navigate("/contact-us")}
            className="bg-white text-sky-600 px-6 py-3 rounded-lg font-semibold hover:bg-sky-50 transition-colors"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default FAQs;
