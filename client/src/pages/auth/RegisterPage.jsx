import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/formatters';
import { BRANCHES, YEARS, SECTIONS } from '../../utils/constants';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        branch: data.branch,
        year: data.year,
        section: data.section,
        rollNumber: data.rollNumber,
        department: data.branch, // department defaults to branch for students
      });
      toast.success('Account created! Welcome to CampusFlow.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">CampusFlow</h1>
          <p className="text-slate-500 text-sm mt-1">Student Registration</p>
        </div>

        <div className="card p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Create your account</h2>
          <p className="text-sm text-slate-500 mb-6">Student accounts only. Staff accounts are created by the Admin.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-group sm:col-span-2">
                <label className="label">Full Name</label>
                <input
                  type="text"
                  placeholder="Arjun Singh"
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  {...register('name', {
                    required: 'Name is required',
                    minLength: { value: 2, message: 'At least 2 characters' },
                  })}
                />
                {errors.name && <p className="error-text">{errors.name.message}</p>}
              </div>

              <div className="form-group sm:col-span-2">
                <label className="label">College Email</label>
                <input
                  type="email"
                  placeholder="you@college.edu"
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
                  })}
                />
                {errors.email && <p className="error-text">{errors.email.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Roll Number</label>
                <input
                  type="text"
                  placeholder="CSE21001"
                  className={`input ${errors.rollNumber ? 'input-error' : ''}`}
                  {...register('rollNumber', { required: 'Roll number is required' })}
                />
                {errors.rollNumber && <p className="error-text">{errors.rollNumber.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Branch</label>
                <select className={`input ${errors.branch ? 'input-error' : ''}`}
                  {...register('branch', { required: 'Branch is required' })}>
                  <option value="">Select branch</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {errors.branch && <p className="error-text">{errors.branch.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Year</label>
                <select className={`input ${errors.year ? 'input-error' : ''}`}
                  {...register('year', { required: 'Year is required' })}>
                  <option value="">Select year</option>
                  {YEARS.map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                {errors.year && <p className="error-text">{errors.year.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Section</label>
                <select className={`input ${errors.section ? 'input-error' : ''}`}
                  {...register('section', { required: 'Section is required' })}>
                  <option value="">Select section</option>
                  {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
                {errors.section && <p className="error-text">{errors.section.message}</p>}
              </div>

              <div className="form-group sm:col-span-2">
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'At least 6 characters' },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password.message}</p>}
              </div>
            </div>

            <button type="submit" className="btn-primary w-full btn-lg mt-2" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
