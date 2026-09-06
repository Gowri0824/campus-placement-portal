function Statistics({ stats }) {

    return (

        <div className="statistics">


            <h2>
                Placement Statistics
            </h2>


            <div className="statistics-grid">


                <div className="stat-box">

                    <h3>
                        Students Registered
                    </h3>

                    <p>
                        {stats.students}
                    </p>

                </div>



                <div className="stat-box">

                    <h3>
                        Companies Participated
                    </h3>

                    <p>
                        {stats.companies}
                    </p>

                </div>



                <div className="stat-box">

                    <h3>
                        Placement Drives
                    </h3>

                    <p>
                        {stats.drives}
                    </p>

                </div>



                <div className="stat-box">

                    <h3>
                        Applications
                    </h3>

                    <p>
                        {stats.applications}
                    </p>

                </div>


            </div>



            <h2>
                Application Status
            </h2>


            <div className="statistics-grid">


                <div className="stat-box">

                    <h3>
                        Selected
                    </h3>

                    <p>
                        {stats.selected}
                    </p>

                </div>


                <div className="stat-box">

                    <h3>
                        Rejected
                    </h3>

                    <p>
                        {stats.rejected}
                    </p>

                </div>


                <div className="stat-box">

                    <h3>
                        Pending
                    </h3>

                    <p>
                        {stats.pending}
                    </p>

                </div>


                <div className="stat-box">

                    <h3>
                        Withdrawn
                    </h3>

                    <p>
                        {stats.withdrawn}
                    </p>

                </div>


            </div>


        </div>

    );

}


export default Statistics;
