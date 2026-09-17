import { Link } from 'react-router-dom';
import logo from '../../assets/logo/logo2-128.png';

export function Brand({ to = '/', label = 'Neuron home' }) {
    return (
        <Link to={to} className="p-brand" aria-label={label}>
            <img src={logo} alt="" width="28" height="28" />
            <span>Neuron</span>
        </Link>
    );
}

export function Avatar({ user }) {
    return (
        <span className="p-avatar" aria-hidden="true">
            {user.avatar_url
                ? <img src={user.avatar_url} alt="" />
                : (user.display_name?.[0] || '?').toUpperCase()}
        </span>
    );
}
