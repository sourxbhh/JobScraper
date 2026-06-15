import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Jobs from '@/pages/Jobs';
import JobDetail from '@/pages/JobDetail';
import ScrapeTasks from '@/pages/ScrapeTasks';
import Analytics from '@/pages/Analytics';
import Resumes from '@/pages/Resumes';
import InterviewPrep from '@/pages/InterviewPrep';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/scrapes" element={<ScrapeTasks />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/resumes" element={<Resumes />} />
          <Route path="/interview" element={<InterviewPrep />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
