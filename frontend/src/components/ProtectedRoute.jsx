import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user, initializing } = useAuth();
    const location = useLocation();

    if (initializing) {
        return (
            <div className="pulse p-boot" role="status" aria-live="polite">
                <span className="p-boot-bars" aria-hidden="true"><i /><i /><i /></span>
                <span className="p-mono p-dim">Checking your session</span>
            </div>
        );
    }
    if (!user) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }
    return children;
}
