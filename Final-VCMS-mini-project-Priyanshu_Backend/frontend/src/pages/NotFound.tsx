import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // User attempted to access non-existent route
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="relative">
          <div className="text-9xl font-bold text-sky-500">
            404
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Page Not Found</h1>
          <p className="text-slate-700 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-semibold shadow-sm hover:shadow transition-all duration-200 hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold shadow-sm transition-all duration-200 hover:scale-105"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
