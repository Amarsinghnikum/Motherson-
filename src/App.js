
import React from 'react'
import Admin from './Component/admin/Admin'

import { BrowserRouter, Route , Routes } from 'react-router-dom'

import Counter from "./Component/Counter/Counterr"
// import "./App.css"
const App = () => {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path='' element={<Admin/>}/>
          
         
          <Route path='/counterr' element={<Counter/>}/>
        </Routes>
      </BrowserRouter>
      {/* <Admin/>
      <FrontendProject/> */}
    </div>
  )
}

export default App
