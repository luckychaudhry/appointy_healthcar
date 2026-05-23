import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const { backendUrl, token, setToken } = useContext(AppContext)
  const [state, setState] = useState('Sign Up')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  const onSubmitHandler = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      if (state === 'Sign Up') {
        // Signup: create account → redirect to OTP screen
        const { data } = await axios.post(
          backendUrl + '/api/user/register',
          { name, email, password, phone }
        )
        if (data.success) {
          navigate('/verify-otp', {
            state: { userId: data.userId, email, purpose: 'signup' }
          })
        } else {
          toast.error(data.message)
        }

      } else {
        // Login: check credentials → redirect to OTP screen
        const { data } = await axios.post(
          backendUrl + '/api/user/login',
          { email, password }
        )
        if (data.success) {
          navigate('/verify-otp', {
            state: { userId: data.userId, email, purpose: 'login' }
          })
        } else {
          toast.error(data.message)
        }
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) navigate('/')
  }, [token])

  return (
    <form
      onSubmit={onSubmitHandler}
      className='min-h-[80vh] flex items-center bg-white dark:bg-gray-900 transition-colors'
    >
      <div className='flex flex-col gap-3 m-auto items-start p-8
        min-w-[340px] sm:min-w-96
        border dark:border-gray-700 rounded-xl
        text-[#5E5E5E] dark:text-gray-300
        text-sm shadow-lg bg-white dark:bg-gray-800'>

        <p className='text-2xl font-semibold dark:text-gray-100'>
          {state === 'Sign Up' ? 'Create Account' : 'Login'}
        </p>
        <p className='dark:text-gray-400'>
          Please {state === 'Sign Up' ? 'sign up' : 'log in'} to book appointment
        </p>

        {state === 'Sign Up' && (
          <div className='w-full'>
            <p>Full Name</p>
            <input
              onChange={e => setName(e.target.value)}
              value={name}
              className='border border-[#DADADA] dark:border-gray-600 rounded w-full p-2 mt-1
                bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
              type='text'
              required
            />
          </div>
        )}

        {state === 'Sign Up' && (
          <div className='w-full'>
            <p>Mobile Number</p>
            <div className='flex mt-1'>
              <span className='border border-r-0 border-[#DADADA] dark:border-gray-600 rounded-l
                px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm
                flex items-center select-none'>
                +91
              </span>
              <input
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setPhone(val)
                }}
                value={phone}
                className='border border-[#DADADA] dark:border-gray-600 rounded-r w-full p-2
                  bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                type='tel'
                inputMode='numeric'
                placeholder='10-digit mobile number'
                pattern='[0-9]{10}'
                required
              />
            </div>
            {phone.length > 0 && phone.length < 10 && (
              <p className='text-xs text-red-400 mt-1'>Enter a valid 10-digit number</p>
            )}
          </div>
        )}

        <div className='w-full'>
          <p>Email</p>
          <input
            onChange={e => setEmail(e.target.value)}
            value={email}
            className='border border-[#DADADA] dark:border-gray-600 rounded w-full p-2 mt-1
              bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
            type='email'
            required
          />
        </div>

        <div className='w-full'>
          <p>Password</p>
          <input
            onChange={e => setPassword(e.target.value)}
            value={password}
            className='border border-[#DADADA] dark:border-gray-600 rounded w-full p-2 mt-1
              bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
            type='password'
            required
          />
        </div>

        <button
          type='submit'
          disabled={loading}
          className='bg-primary text-white w-full py-2 my-2 rounded-md text-base
            hover:bg-indigo-600 transition-colors disabled:opacity-60'
        >
          {loading ? 'Please wait...' : state === 'Sign Up' ? 'Create account' : 'Continue →'}
        </button>

        <p className='text-xs text-gray-400 dark:text-gray-500 text-center w-full'>
          A one-time password will be sent to your email to verify
        </p>

        {state === 'Sign Up'
          ? <p>Already have an account?{' '}
              <span onClick={() => setState('Login')} className='text-primary underline cursor-pointer'>
                Login here
              </span>
            </p>
          : <p>Create a new account?{' '}
              <span onClick={() => setState('Sign Up')} className='text-primary underline cursor-pointer'>
                Click here
              </span>
            </p>
        }
      </div>
    </form>
  )
}

export default Login
