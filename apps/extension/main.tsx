import {createRoot} from 'react-dom/client';
import {Sidebar} from '../../packages/ui/Sidebar';
import '../../packages/ui/styles.css';
import '../../packages/ui/application.css';
createRoot(document.getElementById('root')!).render(<Sidebar/>);
